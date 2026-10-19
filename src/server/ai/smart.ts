import { ApiError } from "../auth";
import { getSettings } from "../settings";
import type { Source } from "../../lib/websources";
import { hubLookup, hubMode, proposeCandidate, recordOutcome, serveDirect, type Outcome } from "../hub/knowledge";
import { directAnswerText, entrySources, groundedSystem } from "../hub/knowledgelogic";
import { scrubPii } from "../hub/privacy";
import { runFreeAi } from "./gateway";
import { analyzeQuery, needsWeb } from "./intent";
import { runWebSearch, webSearchConfigured, type WebEngine } from "./websearch";

/**
 * Chat uchun yagona kirish. Tartib:
 *  1) AI Bilim markazi (administrator `hubMode=on` qilgan bo'lsa): tasdiqlangan bilim to'g'ri kelsa, AI chaqirilmasdan manbali javob;
 *     qisman mos bo'lsa AI ga tayanch sifatida beriladi. `shadow`: faqat o'lchanadi, javob o'zgarmaydi. `off`: bu qadam yo'q.
 *  2) Savol yangi/rasmiy ma'lumot yoki tayyor material talab qilsa (va avtomatik qidirish yoqilgan bo'lsa) internet qidiruvi oqimi.
 *  3) Aks holda yoki qidiruv imkonsiz bo'lsa, mavjud bepul AI (zaxira tartibi bilan).
 */
export type ChatAnswer = { reply: string; sources: Source[]; queries: string[]; searched: boolean; engine?: WebEngine; origin?: "kb"; entryId?: string };

/** Avtomatik rejimda qidiruv imkonsiz bo'lsa, foydalanuvchini to'smasdan oddiy AI'ga o'tiladi. */
const FALLBACK = new Set(["web_unconfigured", "web_daily_limit", "web_unavailable", "web_no_results"]);

async function autoEnabled() {
  try { return (await getSettings()).ai.webAuto; } catch { return false; }
}

export async function smartFreeChat(userId: string, messages: { role: "user" | "assistant"; content: string }[], opts: { origin?: string } = {}): Promise<ChatAnswer> {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const t0 = Date.now();
  const mode = (await hubMode()) ?? "off";
  // Qidiruvga shaxsiy ma'lumotsiz matn beriladi (raqam va niqoblar moslikni buzmasligi uchun olib tashlanadi).
  const hub = mode === "off" ? null : await hubLookup(scrubPii(question).text.replace(/\[[^\]]+\]/g, " "));
  const kb = hub?.decision.kind ?? "none";

  // 1) Tasdiqlangan bilim: to'g'ridan-to'g'ri javob (AI chaqirilmaydi, AI kunlik limiti sarflanmaydi; daqiqalik chegara saqlanadi)
  if (mode === "on" && hub?.decision.kind === "direct") {
    const { entry } = hub.decision.hit;
    await serveDirect(userId, entry.id, t0);
    await recordOutcome({ subject: hub.subject, topic: hub.topic, outcome: "kb" });
    return { reply: directAnswerText(entry), sources: entrySources(entry.sourceReferences), queries: [], searched: false, origin: "kb", entryId: entry.id };
  }

  // Maxfiylik: tashqi AI/qidiruvga ketadigan matndan telefon, email, karta, kalit kabilar olib tashlanadi (faqat `on` rejimida; chat tarixi o'zgarmaydi).
  const outgoing = mode === "on" ? messages.map((m) => ({ ...m, content: scrubPii(m.content).text })) : messages;
  const system = mode === "on" && hub?.decision.kind === "grounded" ? groundedSystem(hub.decision.hits.map((h) => h.entry)) : undefined;
  const outcome: Outcome = kb === "grounded" ? "grounded" : kb === "direct" ? "kb" : "ai"; // shadow: «bo'lardi» natija o'lchanadi
  const finish = async (r: ChatAnswer, extra: { provider?: string; model?: string; noCandidate?: boolean }) => {
    if (hub) {
      await recordOutcome({ subject: hub.subject, topic: hub.topic, outcome });
      // Administrator kiritgan rasmiy ma'lumotdan (engine "kb") chiqqan javob yangi bilim emas: nomzod qilinmaydi.
      if (!extra.noCandidate) await proposeCandidate({ userId, question, answer: r.reply, mode, kb, subject: hub.subject, topic: hub.topic, provider: extra.provider, model: extra.model, sources: r.sources });
    }
    return r;
  };
  const failed = async (e: unknown) => { if (hub && (!(e instanceof ApiError) || e.status >= 500)) await recordOutcome({ subject: hub.subject, topic: hub.topic, outcome: "error" }); };

  // 2) Internet qidiruvi
  if (webSearchConfigured() && needsWeb(analyzeQuery(question)) && (await autoEnabled())) {
    try {
      const r = await runWebSearch(userId, outgoing, { origin: opts.origin });
      return await finish({ reply: r.text, sources: r.sources, queries: r.queries, searched: true, engine: r.engine }, { provider: r.engine, model: r.model, noCandidate: r.engine === "kb" });
    } catch (e) {
      if (!(e instanceof ApiError && e.code && FALLBACK.has(e.code))) { await failed(e); throw e; }
    }
  }

  // 3) Oddiy bepul AI
  try {
    // `on` rejimida bilim shu yerda allaqachon qidirilgan: gateway qayta qidirmasin (`knowledge: false`).
    const r = mode === "on" ? await runFreeAi(userId, outgoing, { ...(system && { system }), knowledge: false }) : await runFreeAi(userId, outgoing);
    return await finish({ reply: r.text, sources: [], queries: [], searched: false }, { provider: r.provider, model: r.model });
  } catch (e) { await failed(e); throw e; }
}
