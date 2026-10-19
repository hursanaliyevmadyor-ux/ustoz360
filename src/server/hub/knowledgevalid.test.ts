import { describe, expect, it } from "vitest";
import { candidateReviewInput, consentInput, entryActionInput, entryInput, feedbackInput } from "./knowledgevalid";

const future = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
const good = { questionCanonical: "Attestatsiya muddatlari qachon?", answer: "Muddatlar vazirlik buyrug'i bilan e'lon qilinadi, rasmiy saytni kuzating." };

describe("bilim yozuvi kiritish tekshiruvi", () => {
  it("oddiy yozuv: standartlar qo'yiladi", () => {
    const r = entryInput.parse(good);
    expect(r).toMatchObject({ category: "general", sources: [], subject: null, topic: null, expiresOn: null });
  });
  it("savol va javob uzunligi", () => {
    expect(entryInput.safeParse({ ...good, questionCanonical: "qisqa" }).success).toBe(false);
    expect(entryInput.safeParse({ ...good, answer: "juda qisqa" }).success).toBe(false);
    expect(entryInput.safeParse({ ...good, answer: "x".repeat(6001) }).success).toBe(false);
  });
  it("manba faqat https", () => {
    expect(entryInput.safeParse({ ...good, sources: [{ url: "http://eski.uz" }] }).success).toBe(false);
    expect(entryInput.safeParse({ ...good, sources: [{ url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(entryInput.safeParse({ ...good, sources: [{ url: "https://lex.uz/docs/1", title: "Qonun" }] }).success).toBe(true);
  });
  it("me'yoriy yozuv: manba ham, kelajakdagi muddat ham majburiy", () => {
    const n = { ...good, category: "normative" };
    const noSrc = entryInput.safeParse({ ...n, expiresOn: future });
    expect(noSrc.success).toBe(false);
    const noDate = entryInput.safeParse({ ...n, sources: [{ url: "https://lex.uz/1" }] });
    expect(noDate.success).toBe(false);
    const past = entryInput.safeParse({ ...n, sources: [{ url: "https://lex.uz/1" }], expiresOn: "2020-01-01" });
    expect(past.success).toBe(false);
    expect(entryInput.safeParse({ ...n, sources: [{ url: "https://lex.uz/1" }], expiresOn: future }).success).toBe(true);
  });
});

describe("ko'rib chiqish, amal, baho va rozilik", () => {
  it("nomzodni tasdiqlash to'liq yozuv bilan, rad etish izoh bilan", () => {
    expect(candidateReviewInput.safeParse({ decision: "approve", entry: good }).success).toBe(true);
    expect(candidateReviewInput.safeParse({ decision: "approve" }).success).toBe(false);
    expect(candidateReviewInput.parse({ decision: "reject", note: "manba yo'q" })).toEqual({ decision: "reject", note: "manba yo'q" });
    expect(candidateReviewInput.safeParse({ decision: "auto" }).success).toBe(false);
  });
  it("yozuv amali faqat ruxsat etilganlardan", () => {
    for (const a of ["archive", "flag", "recheck", "restore"]) expect(entryActionInput.safeParse({ action: a }).success, a).toBe(true);
    expect(entryActionInput.safeParse({ action: "delete" }).success).toBe(false);
  });
  it("baho: faqat +1 yoki -1, sabab ro'yxatdan", () => {
    expect(feedbackInput.safeParse({ entryId: "x", rating: 1 }).success).toBe(true);
    expect(feedbackInput.safeParse({ entryId: "x", rating: -1, reason: "outdated" }).success).toBe(true);
    expect(feedbackInput.safeParse({ entryId: "x", rating: 5 }).success).toBe(false);
    expect(feedbackInput.safeParse({ entryId: "x", rating: 1, reason: "boshqa" }).success).toBe(false);
  });
  it("rozilik: faqat mantiqiy qiymat", () => {
    expect(consentInput.safeParse({ enabled: true }).success).toBe(true);
    expect(consentInput.safeParse({ enabled: "ha" }).success).toBe(false);
  });
});
