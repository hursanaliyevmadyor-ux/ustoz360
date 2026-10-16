/** Mashq (Bilim laboratoriyasi) uchun sof funksiyalar: bazaga va AI'ga bog'liq emas, unit test bilan tekshiriladi. */
import { z } from "zod";

/**
 * Test dvigateli rejimlari. quick/topic/ai: Bilim laboratoriyasi (oddiy mashq); topictest: Mavzuli test; timed: Vaqtli test;
 * mixed: Aralash test; situational: Murakkab vaziyatli test; errors: Xatolar testi.
 */
export const KINDS = ["quick", "topic", "errors", "ai", "timed", "topictest", "mixed", "situational"] as const;
export type Kind = (typeof KINDS)[number];
export const COUNTS = [5, 10, 15, 20, 30, 50] as const;
export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "MIXED"] as const;
export type DifficultyChoice = (typeof DIFFICULTIES)[number];

/** TestSession.mode (bazadagi enum) ga moslash. */
export const DB_MODE: Record<Kind, "PRACTICE" | "TIMED" | "TOPIC" | "MIXED" | "ERRORS" | "SITUATIONAL"> = {
  quick: "PRACTICE", topic: "PRACTICE", ai: "PRACTICE", errors: "ERRORS", timed: "TIMED", topictest: "TOPIC", mixed: "MIXED", situational: "SITUATIONAL",
};
export const ENGINE_MODES = ["PRACTICE", "TIMED", "TOPIC", "MIXED", "ERRORS", "SITUATIONAL"] as const;

/** instant: javob darhol tekshiriladi va izoh ochiladi. deferred: javoblar yakunda tekshiriladi (test davomida kalit ko'rsatilmaydi). */
export type Policy = "instant" | "deferred";
export const policyOf = (k: Kind): Policy => (k === "timed" || k === "mixed" ? "deferred" : "instant");

export const MIN_DURATION = 1, MAX_DURATION = 180;

export const startInput = z.object({
  kind: z.enum(KINDS),
  topicIds: z.array(z.string().min(1)).max(60).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  count: z.number().int().refine((n) => (COUNTS as readonly number[]).includes(n), "Savollar soni 5, 10, 15, 20, 30 yoki 50 bo'lishi kerak.").optional(),
  /** Daqiqada. Vaqtli testda majburiy, boshqa rejimlarda ixtiyoriy. */
  durationMin: z.number().int().min(MIN_DURATION).max(MAX_DURATION).optional(),
  /** Xatolar testi: eski savollar yoki shu ko'nikmaga oid yangi savollar. */
  variant: z.enum(["old", "new"]).optional(),
  /** Aralash test: savollar taqsimoti. */
  distribution: z.enum(["equal", "weak"]).optional(),
  /** Faqat shu ko'nikmalarga oid savollar (natijadagi tavsiyadan). */
  skills: z.array(z.string().min(1).max(120)).max(10).optional(),
});
export type StartInput = z.infer<typeof startInput>;

export const defaultCount = (kind: Kind) => (kind === "quick" ? 5 : 10);

/** Savollar soniga mos taklif qilinadigan vaqtlar (daqiqa): savolga ~1, ~1.5 va ~2 daqiqa. */
export function timeOptions(count: number): number[] {
  const r = (x: number) => Math.max(5, Math.round(x / 5) * 5);
  return [...new Set([r(count), r(count * 1.5), r(count * 2)])];
}

/**
 * Aralash test: savollar sonini mavzular o'rtasida taqsimlaydi (D'Hondt usuli).
 * Teng og'irlikda aylanma tartibda beriladi; mavzuda savol yetmasa (cap), qolgani boshqalarga o'tadi.
 */
export function allocate(total: number, items: { id: string; weight: number; cap: number }[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(items.map((i) => [i.id, 0]));
  const sumCap = items.reduce((n, i) => n + i.cap, 0);
  for (let k = 0; k < Math.min(total, sumCap); k++) {
    let best: { id: string; score: number } | null = null;
    for (const i of items) {
      if (out[i.id] >= i.cap) continue;
      const score = Math.max(i.weight, 0.01) / (out[i.id] + 1);
      if (!best || score > best.score) best = { id: i.id, score };
    }
    if (!best) break;
    out[best.id]++;
  }
  return out;
}

/** "Zaif mavzular ko'proq" taqsimoti uchun og'irliklar: natijasi past yoki hali yechilmagan mavzu ko'proq savol oladi. */
export function weakWeight(m: { correct: number; total: number } | undefined): number {
  if (!m || m.total === 0) return 1.5;
  return 1 + 2 * (1 - m.correct / m.total);
}

/** Mashq sozlamalari (TestSession.config). Javob kaliti bu yerda saqlanmaydi. */
export const configSchema = z.object({
  v: z.literal(1).default(1),
  kind: z.enum(KINDS),
  topicIds: z.array(z.string()).default([]),
  difficulty: z.enum(DIFFICULTIES).default("MIXED"),
  requested: z.number().int().default(5),
  /** savol id -> variantlar id tartibi (davom ettirilganda bir xil ko'rinadi) */
  order: z.record(z.string(), z.array(z.string())).default({}),
  /** savol id -> ishora sifatida chiqarib tashlangan noto'g'ri variant id */
  hints: z.record(z.string(), z.string()).default({}),
  policy: z.enum(["instant", "deferred"]).default("instant"),
  /** Taymer (soniya). Server vaqti bo'yicha hisoblanadi: TestSession.startedAt + durationSec. */
  durationSec: z.number().int().nullable().default(null),
  variant: z.enum(["old", "new"]).nullable().default(null),
  distribution: z.enum(["equal", "weak"]).nullable().default(null),
  skills: z.array(z.string()).default([]),
  /** Yakunda tekshiriladigan rejimlar: savol id -> tanlangan variant (o) va vaqt (t, ms). Yakunlanmaguncha UserAnswer yaratilmaydi. */
  answers: z.record(z.string(), z.object({ o: z.string(), t: z.number() })).default({}),
  /** Belgilab qo'yilgan savollar. */
  flags: z.record(z.string(), z.boolean()).default({}),
  /** asosiy savol id -> "Tushundimmi?" qo'shimcha savoli va natijasi */
  reinforce: z.record(z.string(), z.object({
    questionId: z.string(),
    kind: z.enum(["new-situation", "similar"]),
    optionOrder: z.array(z.string()).default([]),
    chosenOptionId: z.string().nullable().default(null),
    isCorrect: z.boolean().nullable().default(null),
  })).default({}),
});
export type PracticeConfig = z.infer<typeof configSchema>;

export function parseConfig(raw: unknown): PracticeConfig {
  const r = configSchema.safeParse(raw ?? {});
  return r.success ? r.data : configSchema.parse({ kind: "topic" });
}

export const KIND_LABEL: Record<Kind, string> = {
  quick: "Tezkor mashq", topic: "Mavzuli mashq", errors: "Xatolar testi", ai: "AI bilan o'rganish",
  timed: "Vaqtli test", topictest: "Mavzuli test", mixed: "Aralash test", situational: "Murakkab vaziyatli test",
};

// ---------- Bilim xaritasi 2.0 ----------
export type MasteryState = "NEW" | "LEARNING" | "REINFORCING" | "STABLE";
export const MASTERY_LABEL: Record<MasteryState, string> = {
  NEW: "Hali mashq qilinmagan", LEARNING: "O'rganilmoqda", REINFORCING: "Mustahkamlanmoqda", STABLE: "Barqaror natija kuzatilmoqda",
};
export const MASTERY_HINT: Record<MasteryState, string> = {
  NEW: "Birinchi mashqni boshlang.",
  LEARNING: "Yana bir nechta savol yeching va izohlarni o'qing.",
  REINFORCING: "Xatolaringizni qayta ko'rib chiqing, natija mustahkamlanib boryapti.",
  STABLE: "Natija yaxshi. Vaqti-vaqti bilan qayta tekshirib turing.",
};

export type MasteryInput = { total: number; correct: number; openErrors: number; nonEasyCorrect: number };

/**
 * Holat faqat kuzatilgan natijaga tayanadi. "O'zlashtirdi" deb xulosa qilinmaydi:
 * kam savol, faqat oson savollar yoki ochiq xatolar bo'lsa, eng yuqori holatga o'tmaydi.
 */
export function masteryState(i: MasteryInput): MasteryState {
  if (i.total <= 0) return "NEW";
  const acc = i.correct / i.total;
  if (i.total < 4 || acc < 0.6) return "LEARNING";
  if (i.total >= 8 && acc >= 0.85 && i.openErrors === 0 && i.nonEasyCorrect >= 2) return "STABLE";
  return "REINFORCING";
}

// ---------- Natija ----------
export function headline(percent: number): { title: string; text: string } {
  if (percent >= 80) return { title: "Bugun yaxshi mashq qildingiz!", text: "Bilim sari tashlagan har bir qadam muhim. Davom eting!" };
  if (percent >= 50) return { title: "Yaxshi boshlanish!", text: "Ba'zi joylar hali mustahkamlanishi kerak. Xatolar ustida ishlash eng tez yo'l." };
  return { title: "Muhimi: sababini tushunish", text: "Bu mavzu hali yangi bo'lishi mumkin. Izohlarni o'qib, qayta urinib ko'rish yetarli." };
}

export type TopicStat = { topicId: string; name: string; correct: number; total: number };
export function summarizeTopics(stats: TopicStat[]) {
  const strengths = stats.filter((t) => t.total > 0 && t.correct / t.total >= 0.75).map((t) => t.name);
  const toReinforce = stats.filter((t) => t.total > 0 && t.correct / t.total < 0.75).map((t) => t.name);
  return { strengths, toReinforce };
}

export type NextStep = { title: string; text: string; action: "errors" | "topic" | "map" | "skills"; topicId?: string; skills?: string[] };
export type SkillStat = { skill: string; correct: number; total: number };

export function skillStats(rows: { skill: string | null; isCorrect: boolean }[]): SkillStat[] {
  const m = new Map<string, SkillStat>();
  for (const r of rows) {
    if (!r.skill) continue;
    const e = m.get(r.skill) ?? { skill: r.skill, correct: 0, total: 0 };
    e.total++; if (r.isCorrect) e.correct++; m.set(r.skill, e);
  }
  return [...m.values()];
}

/** Tavsiya aniq va bajariladigan bo'ladi: qaysi tushunchada adashilgani va nechta savol ishlash kerakligi aytiladi. */
export function nextStep(stats: TopicStat[], wrongCount: number, skills: SkillStat[] = []): NextStep {
  const weakSkills = skills.filter((s) => s.correct < s.total).sort((a, b) => (b.total - b.correct) - (a.total - a.correct)).slice(0, 2);
  if (weakSkills.length > 0 && wrongCount > 0) {
    const names = weakSkills.map((s) => `«${s.skill}»`).join(" va ");
    const wrong = weakSkills.reduce((n, s) => n + (s.total - s.correct), 0);
    return { title: "Keyingi qadam", text: `Siz ${names} tushunchasida ${wrong} marta adashdingiz. Shu ko'nikmaga oid ${Math.max(5, wrong * 2)} ta savol ishlash tavsiya etiladi.`, action: "skills", skills: weakSkills.map((s) => s.skill) };
  }
  const weak = [...stats].filter((t) => t.total > 0 && t.correct < t.total).sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
  if (weak && wrongCount > 0) return { title: "Keyingi qadam", text: `«${weak.name}» mavzusida yana mashq qilib, xatolaringizni mustahkamlang.`, action: "topic", topicId: weak.topicId };
  if (wrongCount > 0) return { title: "Keyingi qadam", text: "Xatolaringizni ko'rib chiqing va ular ustida ishlang.", action: "errors" };
  return { title: "Keyingi qadam", text: "Bilim xaritangizni ko'rib, yangi mavzuni tanlang.", action: "map" };
}

// ---------- AI javobini tekshirish ----------
/** Matndan birinchi JSON ob'ektni ajratib oladi (model ```json ... ``` bilan o'rab yuborgan bo'lsa ham). */
export function extractJson(text: string): unknown | null {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

export const textReply = z.object({ text: z.string().trim().min(1).max(2000) });
export const variantsReply = z.object({
  items: z.array(z.object({ label: z.string().trim().min(1).max(3), correct: z.boolean(), why: z.string().trim().min(1).max(500) })).min(2).max(8),
});

/** "Qaroringizni asoslang": AI tahlili mezonlarga tayanadi va noaniqlikni ko'rsatadi. */
export const rationaleReply = z.object({
  strengths: z.array(z.string().trim().min(1).max(300)).max(3).default([]),
  improve: z.array(z.string().trim().min(1).max(300)).max(3).default([]),
  uncertainty: z.string().trim().max(300).default(""),
});

export const aiQuestionSchema = z.object({
  text: z.string().trim().min(20).max(700),
  options: z.array(z.string().trim().min(1).max(250)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(10).max(900),
  superKey: z.string().trim().min(3).max(250).optional(),
});
export type AiQuestion = z.infer<typeof aiQuestionSchema>;

const norm = (s: string) => s.toLowerCase().replace(/[\s.,;:!?'"`’‘ʻʼ-]+/g, " ").trim();

/** AI yaratgan savolni sifat shartlaridan o'tkazadi. Sabab qaytarsa: savol rad etiladi. */
export function checkAiQuestion(q: AiQuestion, original: { text: string; options: string[] }): string | null {
  const opts = q.options.map(norm);
  if (new Set(opts).size !== opts.length) return "variantlar takrorlanadi";
  if (norm(q.text) === norm(original.text)) return "savol asl nusxaning o'zi";
  const origSet = new Set(original.options.map(norm));
  if (opts.every((o) => origSet.has(o))) return "variantlar asl nusxadan ko'chirilgan";
  if (opts.some((o) => /^(barcha|hammasi|hech biri|yuqoridagilarning)/.test(o))) return "«barchasi/hech biri» turidagi variant";
  if (norm(q.text).length < 20) return "savol juda qisqa";
  return null;
}

/** AI ishlamaganda variantlar tahlili: faqat saqlangan kalit va izohga tayanadi. */
export function localVariantsAnalysis(options: { label: string; text: string; isCorrect: boolean }[], explanation: string) {
  return options.map((o) => ({
    label: o.label, correct: o.isCorrect,
    why: o.isCorrect ? `To'g'ri javob. ${explanation}` : "Bu variant to'g'ri javob emas. Sababini yuqoridagi izohdan toping.",
  }));
}

export const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];
