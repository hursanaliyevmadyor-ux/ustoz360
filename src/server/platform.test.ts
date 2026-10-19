import { describe, expect, it } from "vitest";
import { z } from "zod";
import { canTransition, checkoutUrl, makeReference, signBody, verifySignature, webhookEventSchema } from "./paymentlogic";
import { activePlan, aiLimitFor, nextSubscriptionEnd } from "./entitlementlogic";
import { csvCell, toCsv } from "./csv";
import { roleChangeError } from "./adminusers";
import { mergeSetting, SETTING_DEFAULTS, settingSchemas, visibleAnnouncements } from "./settingsdef";
import { costMicro, isRetryableStatus, retryDelayMs } from "./ai/gatewaylogic";
import { parseStructured } from "./ai/parse";
import { courseInput, nextStatusAfterEdit, courseReviewInput } from "./marketvalid";
import { fmtUzs } from "../lib/plans";

const D = (s: string) => new Date(s);

describe("to'lov: yordamchi mantiq", () => {
  it("buyurtma kodi chalkash belgilarsiz va noyob", () => {
    const set = new Set(Array.from({ length: 200 }, makeReference));
    expect(set.size).toBe(200);
    for (const r of set) expect(r).toMatch(/^U360-[A-HJKMNP-Z2-9]{8}$/);
  });
  it("webhook imzosi: to'g'ri imzo o'tadi, o'zgargan matn yoki noto'g'ri kalit o'tmaydi", () => {
    const raw = JSON.stringify({ eventId: "e1", reference: "U360-AAAAAAAA", amount: 1000, status: "paid" });
    const sig = signBody("s3cret", raw);
    expect(verifySignature("s3cret", raw, sig)).toBe(true);
    expect(verifySignature("s3cret", raw, `sha256=${sig}`)).toBe(true);
    expect(verifySignature("s3cret", raw + " ", sig)).toBe(false);
    expect(verifySignature("boshqa", raw, sig)).toBe(false);
    expect(verifySignature("s3cret", raw, "zz")).toBe(false);
    expect(verifySignature("s3cret", raw, null)).toBe(false);
    expect(verifySignature("", raw, sig)).toBe(false);
  });
  it("webhook xabari sxemasi summani butun son talab qiladi", () => {
    expect(webhookEventSchema.safeParse({ eventId: "a", reference: "U360-AAAAAAAA", amount: 100, status: "paid" }).success).toBe(true);
    expect(webhookEventSchema.safeParse({ eventId: "a", reference: "U360-AAAAAAAA", amount: 10.5, status: "paid" }).success).toBe(false);
    expect(webhookEventSchema.safeParse({ eventId: "a", reference: "U360-AAAAAAAA", amount: 100, status: "ok" }).success).toBe(false);
  });
  it("holat o'tishlari: to'langan faqat qaytariladi, yopilgan holatdan qaytib bo'lmaydi", () => {
    expect(canTransition("PENDING", "PAID")).toBe(true);
    expect(canTransition("PENDING", "CANCELED")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
    expect(canTransition("PAID", "CANCELED")).toBe(false);
    expect(canTransition("CANCELED", "PAID")).toBe(false);
    expect(canTransition("REFUNDED", "PAID")).toBe(false);
    expect(canTransition("YOQ", "PAID")).toBe(false);
  });
  it("to'lov havolasi shablonidan kod va summa qo'yiladi", () => {
    expect(checkoutUrl("https://pay.example/c?ref={reference}&sum={amount}", { reference: "U360-AB", amount: 39000 })).toBe("https://pay.example/c?ref=U360-AB&sum=39000");
  });
  it("pul ko'rinishi", () => { expect(fmtUzs(189000)).toBe("189 000 so'm"); expect(fmtUzs(0)).toBe("0 so'm"); expect(fmtUzs(1234567)).toBe("1 234 567 so'm"); });
});

describe("huquqlar (tarif)", () => {
  const now = D("2026-10-17T10:00:00Z");
  it("obuna yo'q bo'lsa FREE", () => expect(activePlan([], now)).toBe("FREE"));
  it("faol obuna eng yuqori tarifni beradi", () => {
    expect(activePlan([{ planKey: "PRO", status: "ACTIVE", startsAt: D("2026-10-01"), endsAt: D("2026-11-01") }, { planKey: "PREMIUM", status: "ACTIVE", startsAt: D("2026-10-05"), endsAt: null }], now)).toBe("PREMIUM");
  });
  it("muddati o'tgan, bekor qilingan yoki hali boshlanmagan obuna hisobga olinmaydi", () => {
    expect(activePlan([{ planKey: "PRO", status: "ACTIVE", startsAt: D("2026-09-01"), endsAt: D("2026-10-10") }], now)).toBe("FREE");
    expect(activePlan([{ planKey: "PRO", status: "CANCELED", startsAt: D("2026-10-01"), endsAt: null }], now)).toBe("FREE");
    expect(activePlan([{ planKey: "PRO", status: "ACTIVE", startsAt: D("2026-11-01"), endsAt: null }], now)).toBe("FREE");
    expect(activePlan([{ planKey: "NOMA'LUM", status: "ACTIVE", startsAt: D("2026-10-01"), endsAt: null }], now)).toBe("FREE");
  });
  it("AI limiti tarifga qarab o'sadi", () => { expect(aiLimitFor("FREE", 30)).toBe(30); expect(aiLimitFor("PRO", 30)).toBe(60); expect(aiLimitFor("PREMIUM", 30)).toBe(90); expect(aiLimitFor("FREE", 0)).toBe(1); });
  it("obuna uzaytirilganda tugamagan muddatdan keyin 30 kun qo'shiladi", () => {
    expect(nextSubscriptionEnd(null, now).toISOString()).toBe("2026-11-16T10:00:00.000Z");
    expect(nextSubscriptionEnd(D("2026-10-20T10:00:00Z"), now).toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(nextSubscriptionEnd(D("2026-10-01T10:00:00Z"), now).toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });
});

describe("CSV", () => {
  it("formula bilan boshlanadigan katak xavfsizlanadi, vergul va qo'shtirnoq o'raladi", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+998")).toBe("'+998");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe("");
    expect(csvCell(D("2026-10-17T00:00:00Z"))).toBe("2026-10-17T00:00:00.000Z");
  });
  it("sarlavha va qatorlar BOM bilan", () => {
    const out = toCsv([{ key: "a", label: "A" }, { key: "b", label: "B" }], [{ a: 1, b: "x" }, { a: 2, b: "y,z" }]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out.slice(1).trim().split("\r\n")).toEqual(["A,B", "1,x", '2,"y,z"']);
  });
});

describe("rol o'zgartirish qoidalari", () => {
  const base = { actorId: "a", actorRoles: ["ADMIN"], targetId: "t", before: ["TEACHER"], after: ["TEACHER", "COURSE_AUTHOR"], adminsLeft: 2 };
  it("oddiy rol berish ruxsat", () => expect(roleChangeError(base)).toBeNull());
  it("o'z rolini o'zgartira olmaydi", () => expect(roleChangeError({ ...base, targetId: "a" })).toMatch(/O'z rollaringizni/));
  it("bosh administrator rolini faqat bosh administrator o'zgartiradi", () => {
    expect(roleChangeError({ ...base, after: ["TEACHER", "SUPERADMIN"] })).toMatch(/Bosh administrator/);
    expect(roleChangeError({ ...base, actorRoles: ["SUPERADMIN"], after: ["TEACHER", "SUPERADMIN"] })).toBeNull();
  });
  it("oxirgi administratorni olib tashlab bo'lmaydi", () => {
    expect(roleChangeError({ ...base, before: ["TEACHER", "ADMIN"], after: ["TEACHER"], adminsLeft: 1 })).toMatch(/Oxirgi/);
    expect(roleChangeError({ ...base, before: ["TEACHER", "ADMIN"], after: ["TEACHER"], adminsLeft: 2 })).toBeNull();
  });
});

describe("sozlamalar", () => {
  it("standart qiymatlar o'z sxemasidan o'tadi", () => {
    for (const k of Object.keys(settingSchemas) as (keyof typeof settingSchemas)[]) expect(settingSchemas[k].safeParse(SETTING_DEFAULTS[k]).success).toBe(true);
  });
  it("buzilgan yoki yo'q qiymat standartga qaytadi, qisman qiymat birlashadi", () => {
    expect(mergeSetting("modules", null)).toEqual(SETTING_DEFAULTS.modules);
    expect(mergeSetting("modules", { ai: "ha" })).toEqual(SETTING_DEFAULTS.modules);
    expect(mergeSetting("modules", { market: false }).market).toBe(false);
    expect(mergeSetting("modules", { market: false }).ai).toBe(true);
  });
  it("markaziy bilim xizmati standart bo'yicha o'chiq (hubMode=off); eski saqlangan AI sozlamasi buzilmaydi", () => {
    expect(SETTING_DEFAULTS.ai.hubMode).toBe("off");
    const { hubMode: _omit, ...old } = SETTING_DEFAULTS.ai; void _omit; // hubMode qo'shilishidan oldin saqlangan qiymat
    expect(mergeSetting("ai", { ...old, perMinute: 9 })).toMatchObject({ perMinute: 9, hubMode: "off" });
    expect(mergeSetting("ai", { hubMode: "shadow" }).hubMode).toBe("shadow");
    expect(mergeSetting("ai", { hubMode: "sharpa" }).hubMode).toBe("off");
    expect(settingSchemas.ai.safeParse({ ...SETTING_DEFAULTS.ai, hubMode: "yoq" }).success).toBe(false);
  });
  it("to'lov rejimi faqat ruxsat etilgan qiymatlar", () => {
    expect(settingSchemas.payments.safeParse({ mode: "stripe", manualInstructions: "", minPriceUzs: 0 }).success).toBe(false);
  });
  it("sozlamalarda maxfiy kalit uchun maydon yo'q", () => {
    const text = JSON.stringify(Object.values(SETTING_DEFAULTS).flatMap((v) => Object.keys(v))).toLowerCase();
    expect(text).not.toMatch(/secret|apikey|api_key|token|password|parol/);
  });
});

describe("e'lonlar (bosh sahifa)", () => {
  const a = (p: Partial<{ id: string; title: string; text: string; href: string; active: boolean; until: string }> = {}) => ({ id: "x", title: "Yangi seminar", text: "", href: "/seminarlar", active: true, until: "", ...p });
  it("faqat faol va muddati o'tmagan e'lonlar ko'rinadi (tugash kuni ham ko'rinadi)", () => {
    const list = [a({ id: "1" }), a({ id: "2", active: false }), a({ id: "3", until: "2026-10-16" }), a({ id: "4", until: "2026-10-17" }), a({ id: "5", until: "2026-12-01" })];
    expect(visibleAnnouncements(list, "2026-10-17").map((x) => x.id)).toEqual(["1", "4", "5"]);
  });
  it("havola: sayt ichidagi yo'l yoki https; javascript:, http:, // rad etiladi", () => {
    const ok = (href: string) => settingSchemas.announcements.safeParse({ items: [a({ href })] }).success;
    expect(ok("")).toBe(true); expect(ok("/seminarlar")).toBe(true); expect(ok("https://example.uz/x")).toBe(true);
    expect(ok("javascript:alert(1)")).toBe(false); expect(ok("http://example.uz")).toBe(false); expect(ok("//evil.com")).toBe(false);
  });
  it("sarlavhasiz e'lon, noto'g'ri sana va 10 tadan ko'p e'lon rad etiladi", () => {
    expect(settingSchemas.announcements.safeParse({ items: [a({ title: "" })] }).success).toBe(false);
    expect(settingSchemas.announcements.safeParse({ items: [a({ until: "17.10.2026" })] }).success).toBe(false);
    expect(settingSchemas.announcements.safeParse({ items: Array.from({ length: 11 }, (_, i) => a({ id: String(i) })) }).success).toBe(false);
  });
});

describe("AI shlyuzi yordamchilari", () => {
  it("narx mikro-dollarda, narx 0 bo'lsa hisoblanmaydi", () => {
    expect(costMicro(1000, 500, 3, 15)).toBe(10_500);
    expect(costMicro(1000, 500, 0, 0)).toBeNull();
  });
  it("qayta urinish: 5xx va 408, lekin 429 emas", () => {
    expect(isRetryableStatus(500)).toBe(true); expect(isRetryableStatus(503)).toBe(true); expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(false); expect(isRetryableStatus(400)).toBe(false);
  });
  it("kutish vaqti eksponensial o'sadi", () => {
    const prev = process.env.AI_RETRY_MS;
    process.env.AI_RETRY_MS = "100";
    expect([retryDelayMs(0), retryDelayMs(1), retryDelayMs(2)]).toEqual([100, 200, 400]);
    process.env.AI_RETRY_MS = "0"; expect(retryDelayMs(3)).toBe(0);
    if (prev === undefined) delete process.env.AI_RETRY_MS; else process.env.AI_RETRY_MS = prev;
  });
  const schema = z.object({ items: z.array(z.object({ q: z.string().min(1) })).min(1) });
  it("tuzilmali javob: markdown qobig'idagi JSON o'qiladi", () => {
    const r = parseStructured('```json\n{"items":[{"q":"a"}]}\n```', schema);
    expect(r).toEqual({ ok: true, data: { items: [{ q: "a" }] } });
  });
  it("tuzilmali javob: noto'g'ri sxema yoki JSON yo'q bo'lsa sababi aytiladi", () => {
    const bad = parseStructured('{"items":[]}', schema);
    expect(bad.ok).toBe(false);
    const none = parseStructured("Kechirasiz, bilmayman.", schema);
    expect(none).toEqual({ ok: false, error: "javobda JSON obyekt topilmadi" });
  });
});

describe("MARKET tekshiruvlari", () => {
  const ok = { title: "Matematika metodikasi", description: "Boshlang'ich sinf uchun amaliy kurs tavsifi.", subject: "Matematika", kind: "Videokurs", priceUzs: 100000, lessonCount: 10 };
  it("to'g'ri kurs o'tadi, havola faqat https", () => {
    expect(courseInput.safeParse(ok).success).toBe(true);
    expect(courseInput.safeParse({ ...ok, accessUrl: "https://t.me/kanal" }).success).toBe(true);
    expect(courseInput.safeParse({ ...ok, accessUrl: "http://x.uz" }).success).toBe(false);
    expect(courseInput.safeParse({ ...ok, accessUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("manfiy narx, qisqa tavsif va noma'lum tur rad etiladi", () => {
    expect(courseInput.safeParse({ ...ok, priceUzs: -1 }).success).toBe(false);
    expect(courseInput.safeParse({ ...ok, description: "qisqa" }).success).toBe(false);
    expect(courseInput.safeParse({ ...ok, kind: "Boshqa" }).success).toBe(false);
  });
  it("tasdiqlangan kurs tahrirlansa qayta tekshiruvga tushadi", () => {
    expect(nextStatusAfterEdit("APPROVED")).toBe("REVIEW");
    expect(nextStatusAfterEdit("REVIEW")).toBe("REVIEW");
    expect(nextStatusAfterEdit("REJECTED")).toBe("DRAFT");
    expect(nextStatusAfterEdit("DRAFT")).toBe("DRAFT");
  });
  it("rad etish sababsiz bo'lmaydi", () => {
    expect(courseReviewInput.safeParse({ action: "reject" }).success).toBe(false);
    expect(courseReviewInput.safeParse({ action: "reject", reason: "Mazmun yetarli emas" }).success).toBe(true);
    expect(courseReviewInput.safeParse({ action: "approve" }).success).toBe(true);
  });
});
