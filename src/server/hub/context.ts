import { knowledgeBlock } from "./knowledgelogic";
import { hubLookup, hubMode } from "./lookup";
import { scrubPii } from "./privacy";

/**
 * YAGONA BILIM MANBASI: loyihadagi hamma AI chaqiruvi (gateway: Claude ham, bepul xizmatlar ham; chat, DARSYOR, topshiriq, tushuntirish,
 * mashq izohi, Telegram bot) shu yerdan o'tib, mos tasdiqlangan bilimni «ma'lumot bloki» sifatida oladi. Bilim bitta joyda (AI Bilim markazi),
 * provayderga bog'liq emas. Faqat `hubMode=on` da ishlaydi; xato yoki sekinlikda (4 soniya) ko'rsatma o'zgarmaydi va AI eskicha ishlayveradi.
 */
const LIMIT_MS = 4000;

/** Qidiruvga shaxsiy ma'lumotsiz, qisqartirilgan matn beriladi (raqam va niqoblar moslikni buzmasin). */
export const lookupText = (q: string) => scrubPii(q).text.replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);

async function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<null>((r) => { t = setTimeout(() => r(null), ms); })]); } finally { if (t) clearTimeout(t); }
}

/**
 * `knowledge`: false: bilim qo'shilmaydi (masalan hujjat ichidan javob: manba faqat hujjat) | matn: shu matn bo'yicha qidiriladi (masalan DARSYOR fani va mavzusi) |
 * berilmasa: oxirgi foydalanuvchi xabari bo'yicha. `used`: qo'shilgan yozuvlar soni.
 */
export async function withHubKnowledge(system: string, messages: { role: string; content: string }[], knowledge?: string | false): Promise<{ system: string; used: number }> {
  if (knowledge === false) return { system, used: 0 };
  try {
    if ((await hubMode()) !== "on") return { system, used: 0 };
    const q = typeof knowledge === "string" ? knowledge : [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const text = lookupText(q);
    if (!text) return { system, used: 0 };
    const hub = await within(hubLookup(text, { topic: false }), LIMIT_MS);
    if (!hub || hub.decision.kind === "none") return { system, used: 0 };
    const entries = hub.decision.kind === "direct" ? [hub.decision.hit.entry] : hub.decision.hits.map((h) => h.entry);
    return { system: `${system}\n\n${knowledgeBlock(entries)}`, used: entries.length };
  } catch { return { system, used: 0 }; }
}
