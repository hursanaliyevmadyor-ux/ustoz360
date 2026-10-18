import { ApiError } from "../auth";
import { getSettings } from "../settings";
import type { Source } from "../../lib/websources";
import { runFreeAi } from "./gateway";
import { analyzeQuery, needsWeb } from "./intent";
import { runWebSearch, webSearchConfigured, type WebEngine } from "./websearch";

/**
 * Chat uchun yagona kirish: savol yangi/rasmiy ma'lumot yoki tayyor material talab qilsa (va administrator avtomatik qidirishni yoqqan bo'lsa)
 * internet qidiruvi oqimi ishlaydi; aks holda yoki qidiruv imkonsiz bo'lsa, mavjud bepul AI (zaxira tartibi bilan) javob beradi.
 */
export type ChatAnswer = { reply: string; sources: Source[]; queries: string[]; searched: boolean; engine?: WebEngine };

/** Avtomatik rejimda qidiruv imkonsiz bo'lsa, foydalanuvchini to'smasdan oddiy AI'ga o'tiladi. */
const FALLBACK = new Set(["web_unconfigured", "web_daily_limit", "web_unavailable", "web_no_results"]);

async function autoEnabled() {
  try { return (await getSettings()).ai.webAuto; } catch { return false; }
}

export async function smartFreeChat(userId: string, messages: { role: "user" | "assistant"; content: string }[], opts: { origin?: string } = {}): Promise<ChatAnswer> {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (webSearchConfigured() && needsWeb(analyzeQuery(question)) && (await autoEnabled())) {
    try {
      const r = await runWebSearch(userId, messages, { origin: opts.origin });
      return { reply: r.text, sources: r.sources, queries: r.queries, searched: true, engine: r.engine };
    } catch (e) {
      if (!(e instanceof ApiError && e.code && FALLBACK.has(e.code))) throw e;
    }
  }
  const r = await runFreeAi(userId, messages);
  return { reply: r.text, sources: [], queries: [], searched: false };
}
