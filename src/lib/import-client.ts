/** Aqlli import sahifalari uchun tiplar va yordamchilar (server javoblariga mos). */
export type Opt = { label: string; text: string };

export type ImportStatusInfo = {
  maxMb: number; maxFiles: number; accept: string; formats: string;
  storage: { configured: boolean; directUpload: boolean; chunkBytes: number };
  ai: { vision: boolean; text: boolean; web: boolean; claude: boolean };
  providers: { id: string; label: string; configured: boolean; pdf: boolean; image: boolean; json: boolean; reasoning: boolean; note: string }[];
  usage: { used: number; limit: number; remaining: number } | null;
  blocked: string[];
};

export type SessionRow = { id: string; title: string; status: string; subject: string | null; files: number; questions: number; collectionIds: string[]; createdAt: string; updatedAt: string; label: string | null };

export type FileView = {
  id: string; fileName: string; kind: string; kindLabel: string; role: "AUTO" | "QUESTIONS" | "ANSWERS" | "MATERIAL"; sizeBytes: number; parseStatus: string; parseError: string | null;
  pageCount: number | null; note: string | null; docKinds: { kind: string; from: number; to: number }[] | null; extracted: number; progress: { done: number; total: number } | null;
};

export type SessionView = {
  id: string; title: string; status: string; step: string; subject: string | null; error: string | null; label: string | null; warnings: string[]; aiBlocked: string | null;
  createdAt: string; updatedAt: string; completedAt: string | null; files: FileView[];
  counts: { total: number; ready: number; review: number; noAnswer: number; conflict: number; unsupported: number; incomplete: number; approved: number; removed: number; withKey: number };
  collections: { id: string; title: string }[];
};

export type AnswerView = { key: string[] | null; keySource: string | null; proposed: string[] | null; final: string[] | null; origin: string; status: string; confidence: string | null; explanation: string | null; verifiedAt: string | null; note: string | null };
export type QuestionRow = {
  id: string; seq: number; number: number | null; text: string; original: string | null; options: Opt[]; qtype: string; edited: boolean; reviewStatus: string; decision: string | null;
  ocrUncertain: boolean; note: string | null; sourcePage: string | null; fileId: string | null; fileName: string; topicId: string | null; subjectGuess: string | null; topicGuess: string | null; grade: string | null; difficulty: string; answer: AnswerView;
};
export type EvidenceItem = { type: string; title: string; url?: string; page?: string; quote?: string; note?: string; trust?: string };
export type QuestionDetail = QuestionRow & { evidence: EvidenceItem[]; file: { id: string; fileName: string; kind: string } | null };
export type QuestionList = { total: number; page: number; pages: number; items: QuestionRow[] };
export type StepResult = { status: string; step: string; label: string; done: number; total: number; finished: boolean; wait?: number; message?: string; busy?: boolean };
export type Preview = { kind: string; fileName: string; url: string | null; text: string | null; label: string | null };

export type CollectionRow = {
  id: string; title: string; subject: string | null; topics: string[]; status: string; sourceNote: string | null; counts: { total: number; verified: number; userSet: number; unverified: number };
  state: string; createdAt: string; updatedAt: string; submission: { status: string; at: string; notes: string | null } | null; visibility: string;
};
export type CollectionQuestion = { id: string; pos: number | null; text: string; explanation: string; difficulty: string; answerStatus: string | null; sourceRef: string | null; topic: string; topicId: string; kind: string; options: { id: string; label: string; text: string; isCorrect: boolean }[]; correct: number };
export type CollectionView = Omit<CollectionRow, "topics" | "submission" | "visibility"> & { importSessionId: string | null; editable: boolean; questions: CollectionQuestion[]; submissions: { id: string; status: string; at: string; reviewedAt: string | null; notes: string | null }[] };

export const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Yuklandi", QUEUED: "Navbatda", EXTRACTING: "Savollar ajratilmoqda", CLASSIFYING: "Javoblar kaliti va mavzular", VERIFYING: "Javoblar tekshirilmoqda",
  NEEDS_REVIEW: "Tekshirish kerak", READY_FOR_USER: "Ko'rib chiqishga tayyor", USER_APPROVED: "Testga saqlangan", FAILED: "Xatolik", CANCELED: "Bekor qilingan",
};
export const ACTIVE = ["QUEUED", "EXTRACTING", "CLASSIFYING", "VERIFYING"];
export const REVIEW_LABEL: Record<string, { label: string; tone: "success" | "amber" | "danger" | "neutral" | "blue" }> = {
  READY: { label: "Tayyor", tone: "success" }, NEEDS_REVIEW: { label: "Tekshirish kerak", tone: "amber" }, PENDING: { label: "Tekshirilmagan", tone: "neutral" },
  NO_ANSWER: { label: "Javobi topilmagan", tone: "danger" }, CONFLICT: { label: "Ziddiyatli", tone: "danger" }, UNSUPPORTED: { label: "Mos kelmaydigan tur", tone: "neutral" }, INCOMPLETE: { label: "To'liq emas", tone: "amber" },
};
export const ORIGIN_LABEL: Record<string, string> = {
  FILE_KEY: "Fayldagi kalit", SEPARATE_KEY: "Javoblar kaliti", AI: "AI taklifi", HUB: "Bilim markazi", WEB: "Internet manbasi", LIBRARY: "BILIMXONA", COMPUTED: "Hisoblab topildi", USER: "O'qituvchi belgilagan", NONE: "—",
};
export const EVIDENCE_LABEL: Record<string, string> = { FILE_KEY: "Fayldagi javob belgisi", SEPARATE_KEY: "Javoblar kaliti", COMPUTED: "Hisob", AI: "AI izohi", HUB: "Bilim markazi", LIBRARY: "BILIMXONA", WEB: "Internet manbasi", SOURCE: "Asl fayl" };
export const QTYPE_LABEL: Record<string, string> = { SINGLE: "Bitta javobli", MULTI: "Ko'p javobli", MATCHING: "Moslashtirish", ORDERING: "Ketma-ketlik", SHORT: "Qisqa javob", SITUATIONAL: "Vaziyatli", UNKNOWN: "Noma'lum" };
export const ANSWER_STATUS_LABEL: Record<string, string> = { VERIFIED: "Tasdiqlangan", USER_SET: "O'qituvchi belgilagan", UNVERIFIED: "Tasdiqlanmagan" };
export const COLLECTION_STATE_LABEL: Record<string, string> = { VERIFIED: "Tekshirilgan", TEACHER_CONFIRMED: "O'qituvchi tasdiqlagan", PARTIAL: "Qisman tekshirilgan", UNVERIFIED: "Tasdiqlanmagan", EMPTY: "Bo'sh" };
export const COLLECTION_STATUS_LABEL: Record<string, string> = { PRIVATE_ACTIVE: "Shaxsiy", SUBMITTED_TO_ADMIN: "Admin ko'rib chiqmoqda", PUBLIC_APPROVED: "Umumiy (tasdiqlangan)", REJECTED: "Rad etilgan (shaxsiy)", ARCHIVED: "Arxiv" };

export const mbText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
export const dateText = (iso: string) => { const d = new Date(iso); return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
