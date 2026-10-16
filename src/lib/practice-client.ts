/** Test dvigateli sahifalari uchun tiplar va fetch o'rami. */
export type ApiRes<T> = { ok: true; data: T } | { ok: false; error: string; status: number; code?: string };

export async function call<T = unknown>(url: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<ApiRes<T>> {
  try {
    const r = await fetch(url, { method, ...(body !== undefined && { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, code: (d as { code?: string }).code, error: r.status === 401 ? "Avval tizimga kiring." : (d as { error?: string }).error ?? "Xatolik yuz berdi." };
    return { ok: true, data: d as T };
  } catch { return { ok: false, status: 0, error: "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." }; }
}

export type Kind = "quick" | "topic" | "errors" | "ai" | "timed" | "topictest" | "mixed" | "situational";
export type Option = { id: string; label: string; text: string };
export type AnswerInfo = {
  chosenOptionId: string | null; isCorrect: boolean; hintUsed: boolean; correctOptionId: string | null; explanation: string; superKey: string | null; skill: string | null; rationale: string | null;
};
export type Item = {
  id: string; topic: string; topicId: string; difficulty: "EASY" | "MEDIUM" | "HARD"; text: string; sample: boolean; situational: boolean;
  options: Option[]; hintOptionId: string | null; selectedOptionId: string | null; flagged: boolean; answer: AnswerInfo | null;
  reinforce: { questionId: string; kind: "new-situation" | "similar"; answered: boolean; isCorrect: boolean | null } | null;
};
export type View = {
  id: string; kind: Kind; kindLabel: string; policy: "instant" | "deferred"; status: string; total: number; answered: number; score: number; aiAvailable: boolean; items: Item[];
  timer: { durationSec: number; remainingSec: number } | null;
};

export type AnswerRes = AnswerInfo & { answered: number; total: number; finished: boolean };

export type RationaleResult = { strengths: string[]; improve: string[]; uncertainty: string };
export type CoachEntry = { mode: string; source: "ai" | "stored"; text?: string; items?: { label: string; correct: boolean; why: string }[]; rationale?: RationaleResult; notice?: string };

export type ReinforceRes =
  | { available: false; message: string }
  | { available: true; reinforceQuestionId: string; kind: "new-situation" | "similar"; ai: boolean; text: string; options: Option[]; notice?: string; answered: boolean };
export type ReinforceAnswerRes = { isCorrect: boolean; chosenOptionId: string | null; correctOptionId: string | null; explanation: string; superKey: string | null; message: string };

export type TopicStat = { topicId: string; name: string; correct: number; total: number };
export type SkillStat = { skill: string; correct: number; total: number };
export type Result = {
  id: string; kind: Kind; kindLabel: string; policy: "instant" | "deferred"; status: string; score: number; total: number; answered: number; percent: number; skipped: number; approximate: boolean;
  headline: { title: string; text: string }; topics: TopicStat[]; skills: SkillStat[]; strengths: string[]; toReinforce: string[];
  wrong: { questionId: string; text: string; topic: string; skill: string | null; chosen: string | null; correct: string | null; explanation: string; superKey: string | null }[];
  next: { title: string; text: string; action: "errors" | "topic" | "map" | "skills"; topicId?: string; skills?: string[] };
  timing: { spentSec: number | null; limitSec: number | null; timedOut: boolean };
  flagged: number;
  again: { kind: Kind; topicIds: string[]; difficulty: string; count: number; durationMin: number | null; variant: "old" | "new" | null; distribution: "equal" | "weak" | null };
};

export type Home = {
  active: { id: string; kind: Kind; total: number; answered: number; remainingSec: number | null } | null;
  errorsOpen: number; errorsDue: number; aiAvailable: boolean; approved: number; situational: number;
  history: { id: string; kind: Kind; score: number; total: number; at: string }[];
};
export type TopicInfo = { id: string; name: string; total: number; situational: number; objectives: string[]; counts: { EASY: number; MEDIUM: number; HARD: number } };
export type TopicsData = {
  subjects: { id: string; name: string; topics: TopicInfo[] }[];
  last: { topicIds: string[]; difficulty: string; count: number } | null;
};
export type HistoryItem = {
  id: string; kind: Kind | "diagnostic"; kindLabel: string; status: string; at: string; score: number; total: number; answered: number;
  topics: string[]; subjects: string[]; spentSec: number | null; reviewable: boolean;
};
export type ErrorsProgress = {
  open: number; mastered: number; due: number; soon: number;
  repeated: { text: string; topic: string; skill: string | null; mistakes: number }[]; improved: { topic: string; n: number }[];
};

export const KIND_LABEL: Record<Kind, string> = {
  quick: "Tezkor mashq", topic: "Mavzuli mashq", errors: "Xatolar testi", ai: "AI bilan o'rganish",
  timed: "Vaqtli test", topictest: "Mavzuli test", mixed: "Aralash test", situational: "Murakkab vaziyatli test",
};
export const DIFF_LABEL = { EASY: "Oson", MEDIUM: "O'rta", HARD: "Qiyin" } as const;
const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
/** Brauzerning "uz-UZ" sanasi ba'zi qurilmalarda "M10 16" ko'rinishida chiqadi, shuning uchun oy nomlari qo'lda berilgan. */
export const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()}-${MONTHS[d.getMonth()]}`; };
export const fmtClock = (sec: number) => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s % 60).padStart(2, "0")}`; };
export const fmtDuration = (sec: number) => { const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m} daq ${s} son` : `${s} soniya`; };

/** Oddiy mashq turlari Bilim laboratoriyasida, boshqa rejimlar Testlar bo'limida ochiladi (menyu va yo'l ko'rsatkichi to'g'ri qolishi uchun). */
export const sessionHref = (kind: Kind | string, id: string) => (["quick", "topic", "ai"].includes(kind) ? `/ustoz-ai/mashq/${id}` : `/ustoz-ai/testlar/${id}`);
