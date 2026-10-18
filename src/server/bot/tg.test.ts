import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.TELEGRAM_BOT_TOKEN = "123:ABC";

import { b, editScreen, inline, link, sendPlain, sendScreen, webApp } from "./tg";

const calls: { method: string; body: Record<string, unknown> }[] = [];
let respond: (method: string, body: Record<string, unknown>) => { ok: boolean; description?: string; result?: unknown };

beforeEach(() => {
  calls.length = 0;
  respond = () => ({ ok: true, result: { message_id: 7 } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    const method = String(url).split("/").pop()!, body = JSON.parse(init.body);
    calls.push({ method, body });
    return new Response(JSON.stringify(respond(method, body)), { status: 200 });
  }));
});

describe("Telegram qatlami", () => {
  it("tugmalar: bo'sh qatorlar tushiriladi, havola tugmasi url bilan", () => {
    const k = inline([[b("A", "a.1"), link("Sayt", "https://x.uz")], [], [b("B", "b")]])!;
    expect(k.inline_keyboard).toEqual([[{ text: "A", callback_data: "a.1" }, { text: "Sayt", url: "https://x.uz" }], [{ text: "B", callback_data: "b" }]]);
    expect(inline(undefined)).toBeUndefined();
    expect(inline([[]])?.inline_keyboard).toEqual([]);
  });

  it("Mini App tugmasi web_app sifatida yuboriladi", () => {
    const k = inline([[webApp("📱 Ilova", "https://site.uz")]])!;
    expect(k.inline_keyboard).toEqual([[{ text: "📱 Ilova", web_app: { url: "https://site.uz" } }]]);
  });

  it("64 baytdan uzun callback_data dasturlash xatosi sifatida darhol aniqlanadi", () => {
    expect(() => inline([[b("X", "x".repeat(65))]])).toThrow(/callback_data/);
  });

  it("HTML tahlil xatosida xabar teglarsiz qayta yuboriladi (xabar yo'qolmaydi)", async () => {
    respond = (_m, body) => (body.parse_mode ? { ok: false, description: "Bad Request: can't parse entities: Unsupported start tag" } : { ok: true, result: { message_id: 9 } });
    const id = await sendScreen(1, { text: "<b>Salom</b> &lt;x&gt; <i>dunyo</i>" });
    expect(id).toBe(9);
    expect(calls).toHaveLength(2);
    expect(calls[1].body.parse_mode).toBeUndefined();
    expect(calls[1].body.text).toBe("Salom <x> dunyo");
  });

  it("edit: o'zgarmagan xabar jim o'tadi, eskirgan xabar o'rniga yangisi yuboriladi", async () => {
    respond = () => ({ ok: false, description: "Bad Request: message is not modified" });
    await editScreen(1, 5, { text: "x" });
    expect(calls.map((c) => c.method)).toEqual(["editMessageText"]);

    calls.length = 0;
    respond = (m) => (m === "editMessageText" ? { ok: false, description: "Bad Request: message to edit not found" } : { ok: true, result: { message_id: 2 } });
    await editScreen(1, 5, { text: "yangi", kb: [[b("OK", "ok")]] });
    expect(calls.map((c) => c.method)).toEqual(["editMessageText", "sendMessage"]);
    expect(calls[1].body.text).toBe("yangi");
  });

  it("edit tugmalarsiz ekranda eski tugmalarni olib tashlaydi", async () => {
    await editScreen(1, 5, { text: "tugmasiz" });
    expect(calls[0].body.reply_markup).toEqual({ inline_keyboard: [] });
  });

  it("uzun oddiy matn bo'laklanadi, tugmalar oxirgi bo'lakda, parse_mode yo'q", async () => {
    await sendPlain(1, "a".repeat(9000), [[b("OK", "ok")]]);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.body.parse_mode === undefined)).toBe(true);
    expect(calls[0].body.reply_markup).toBeUndefined();
    expect(calls[2].body.reply_markup).toBeTruthy();
  });

  it("matn 4096 belgidan oshmaydi", async () => {
    await sendScreen(1, { text: "b".repeat(6000) });
    expect(String(calls[0].body.text).length).toBeLessThanOrEqual(4096);
  });
});
