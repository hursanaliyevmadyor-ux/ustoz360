import { Prisma } from "@prisma/client";
import { ApiError } from "./auth";
import { db } from "./db";
import { aiConfigured, freeConfigured } from "./ai/gateway";
import {
  DB_MODE, ENGINE_MODES, LABELS, MASTERY_HINT, MASTERY_LABEL, allocate, defaultCount, headline, labelOf, masteryState, nextStep, parseConfig, policyOf,
  skillStats, summarizeTopics, weakWeight, type Kind, type PracticeConfig, type StartInput, type TopicStat,
} from "./practicelogic";
import { confidenceFor, groupByTopic, nextReview, shuffle } from "./scoring";

const DAY = 86_400_000;
/** Taymer tugagandan keyin ham kechikkan so'rovni qabul qilish uchun qisqa imkon (ms). */
const GRACE = 5_000;
/** Bazaga ulanish sekin bo'lganda (masalan mahalliy kompyuterdan) standart 5 soniyalik tranzaksiya vaqti yetmaydi. */
const TX = { maxWait: 15_000, timeout: 60_000 };

type Json = Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;
const asJson = (c: PracticeConfig) => c as unknown as Json;

/** Dvigatel sessiyalari: rejimi mos va sozlamalari (config) bor. Eski diagnostika/takrorlash sessiyalarida config yo'q. */
const engineWhere = (userId: string): Prisma.TestSessionWhereInput => ({ userId, mode: { in: [...ENGINE_MODES] }, config: { not: Prisma.DbNull } });

async function loadSession(userId: string, id: string) {
  const s = await db.testSession.findFirst({ where: { id, userId, mode: { in: [...ENGINE_MODES] }, config: { not: Prisma.DbNull } } });
  if (!s) throw new ApiError(404, "Mashq topilmadi.");
  return expireIfNeeded(s);
}

type Session = NonNullable<Awaited<ReturnType<typeof db.testSession.findFirst>>>;

/** Server vaqti bo'yicha: taymer tugagan bo'lsa sessiya avtomatik yakunlanadi (sahifani yangilash taymerni qayta boshlamaydi). */
async function expireIfNeeded(s: Session): Promise<Session> {
  const cfg = parseConfig(s.config);
  if (s.status === "IN_PROGRESS" && cfg.durationSec && Date.now() > s.startedAt.getTime() + cfg.durationSec * 1000 + GRACE) {
    await closeSession(s);
    return db.testSession.findUniqueOrThrow({ where: { id: s.id } });
  }
  return s;
}

async function closeSession(s: Session) {
  if (parseConfig(s.config).policy === "deferred") await gradeDeferred(s);
  else await finalize(s.id);
}

/** Konfiguratsiyani o'qib-o'zgartirib yozadi (bir foydalanuvchi, ketma-ket amallar). Yakunda tekshiriladigan rejimlarning javoblari uchun ishlatilmaydi. */
export async function patchConfig(sessionId: string, fn: (c: PracticeConfig) => void) {
  const s = await db.testSession.findUnique({ where: { id: sessionId }, select: { config: true } });
  const cfg = parseConfig(s?.config);
  fn(cfg);
  await db.testSession.update({ where: { id: sessionId }, data: { config: asJson(cfg) } });
  return cfg;
}

const aiOn = () => freeConfigured() || aiConfigured();

// ---------- Bosh sahifa va sozlash uchun ma'lumot ----------
export async function homeData(userId: string) {
  const now = new Date();
  const [active, errorsOpen, errorsDue, recent, approved, situational] = await Promise.all([
    db.testSession.findFirst({ where: { ...engineWhere(userId), status: "IN_PROGRESS", expiresAt: { gt: now } }, orderBy: { startedAt: "desc" } }),
    db.errorCard.count({ where: { userId, mastered: false, question: { status: "APPROVED" } } }),
    db.errorCard.count({ where: { userId, mastered: false, nextReviewAt: { lte: now }, question: { status: "APPROVED" } } }),
    db.testSession.findMany({ where: { ...engineWhere(userId), status: "SUBMITTED" }, orderBy: { startedAt: "desc" }, take: 5 }),
    db.question.count({ where: { status: "APPROVED" } }),
    db.question.count({ where: { status: "APPROVED", kind: "SITUATIONAL" } }),
  ]);
  const activeCfg = active ? parseConfig(active.config) : null;
  const answered = active ? await db.userAnswer.count({ where: { sessionId: active.id } }) : 0;
  const savedAnswers = activeCfg ? Object.keys(activeCfg.answers).length : 0;
  const remainingSec = active && activeCfg?.durationSec ? Math.max(0, Math.round((active.startedAt.getTime() + activeCfg.durationSec * 1000 - now.getTime()) / 1000)) : null;
  return {
    active: active && activeCfg && (remainingSec === null || remainingSec > 0) ? {
      id: active.id, kind: activeCfg.kind, total: (active.questionIds as string[]).length, answered: activeCfg.policy === "deferred" ? savedAnswers : answered, remainingSec,
    } : null,
    errorsOpen, errorsDue, aiAvailable: aiOn(), approved, situational,
    history: recent.map((s) => ({ id: s.id, kind: parseConfig(s.config).kind, score: s.score ?? 0, total: s.total ?? 0, at: s.submittedAt ?? s.startedAt })),
  };
}

/** Davom ettirilmagan mashq/test (bosh sahifa uchun yengil so'rov): vaqti o'tmagan, tugallanmagan eng so'nggi sessiya. */
export async function activePractice(userId: string) {
  const now = new Date();
  const active = await db.testSession.findFirst({ where: { ...engineWhere(userId), status: "IN_PROGRESS", expiresAt: { gt: now } }, orderBy: { startedAt: "desc" } });
  if (!active) return null;
  const cfg = parseConfig(active.config);
  const remainingSec = cfg.durationSec ? Math.max(0, Math.round((active.startedAt.getTime() + cfg.durationSec * 1000 - now.getTime()) / 1000)) : null;
  if (remainingSec !== null && remainingSec <= 0) return null;
  const answered = cfg.policy === "deferred" ? Object.keys(cfg.answers).length : await db.userAnswer.count({ where: { sessionId: active.id } });
  return { id: active.id, kind: cfg.kind, total: (active.questionIds as string[]).length, answered, remainingSec };
}

export async function topicsData(userId: string) {
  const [subjects, groups, last] = await Promise.all([
    db.subject.findMany({ where: { slug: { not: "shaxsiy-testlar" } }, include: { topics: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }),
    db.question.groupBy({ by: ["topicId", "difficulty", "kind"], where: { status: "APPROVED" }, _count: { _all: true } }),
    db.testSession.findFirst({ where: engineWhere(userId), orderBy: { startedAt: "desc" }, select: { config: true } }),
  ]);
  const counts = new Map<string, { EASY: number; MEDIUM: number; HARD: number; situational: number }>();
  for (const g of groups) {
    const e = counts.get(g.topicId) ?? { EASY: 0, MEDIUM: 0, HARD: 0, situational: 0 };
    e[g.difficulty] += g._count._all;
    if (g.kind === "SITUATIONAL") e.situational += g._count._all;
    counts.set(g.topicId, e);
  }
  const lastCfg = last ? parseConfig(last.config) : null;
  return {
    subjects: subjects.map((s) => ({
      id: s.id, name: s.name,
      topics: s.topics.map((t) => {
        const c = counts.get(t.id) ?? { EASY: 0, MEDIUM: 0, HARD: 0, situational: 0 };
        return { id: t.id, name: t.name, objectives: t.objectives, counts: { EASY: c.EASY, MEDIUM: c.MEDIUM, HARD: c.HARD }, situational: c.situational, total: c.EASY + c.MEDIUM + c.HARD };
      }),
    })),
    last: lastCfg ? { topicIds: lastCfg.topicIds, difficulty: lastCfg.difficulty, count: lastCfg.requested } : null,
  };
}

// ---------- Boshlash ----------
async function seenIds(userId: string) {
  const seen = await db.userAnswer.findMany({ where: { session: { userId } }, select: { questionId: true }, distinct: ["questionId"] });
  return new Set(seen.map((s) => s.questionId));
}
/** Avval hali ko'rilmagan savollar, keyin ko'rilganlari. */
const unseenFirst = (ids: string[], seen: Set<string>) => { const s = shuffle(ids); return [...s.filter((i) => !seen.has(i)), ...s.filter((i) => seen.has(i))]; };

function baseWhere(input: StartInput): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = { status: "APPROVED" };
  if (input.topicIds?.length) where.topicId = { in: input.topicIds };
  if (input.difficulty && input.difficulty !== "MIXED") where.difficulty = input.difficulty;
  if (input.skills?.length) where.skill = { in: input.skills };
  if (input.kind === "situational") where.kind = "SITUATIONAL";
  return where;
}

async function pickIds(userId: string, input: StartInput, count: number): Promise<string[]> {
  if (input.kind === "errors") {
    const cards = await db.errorCard.findMany({
      where: { userId, mastered: false, question: { status: "APPROVED" } },
      orderBy: { nextReviewAt: "asc" }, select: { questionId: true, question: { select: { skill: true, topicId: true } } },
    });
    if (cards.length === 0) throw new ApiError(404, "Hozircha xatolar daftaringiz bo'sh. Avval mashq qilib ko'ring.", "NO_ERRORS");
    if (input.variant !== "new") return shuffle(cards.slice(0, count).map((c) => c.questionId));
    // "Yangi vaziyatda sinash": o'sha ko'nikmaga (ko'nikma yo'q bo'lsa, mavzuga) oid, lekin boshqa savollar.
    const errIds = cards.map((c) => c.questionId);
    const skills = [...new Set(cards.map((c) => c.question.skill).filter((s): s is string => !!s))];
    const topics = [...new Set(cards.filter((c) => !c.question.skill).map((c) => c.question.topicId))];
    const pool = await db.question.findMany({ where: { status: "APPROVED", source: { not: "AI" }, id: { notIn: errIds }, OR: [{ skill: { in: skills } }, { topicId: { in: topics } }] }, select: { id: true } });
    if (pool.length === 0) throw new ApiError(404, "Xatolaringizga oid yangi vaziyatdagi savollar hali yo'q. «Eski xatolarim» bilan mustahkamlashingiz mumkin.", "NO_NEW_QUESTIONS");
    return unseenFirst(pool.map((p) => p.id), await seenIds(userId)).slice(0, count);
  }

  if (input.kind === "mixed") {
    const topicIds = input.topicIds ?? [];
    const [pool, seen, mastery] = await Promise.all([
      db.question.findMany({ where: baseWhere(input), select: { id: true, topicId: true } }),
      seenIds(userId),
      input.distribution === "weak" ? db.topicMastery.findMany({ where: { userId, topicId: { in: topicIds } } }) : Promise.resolve([]),
    ]);
    if (pool.length === 0) throw new ApiError(404, "Tanlangan mavzularda hozircha tasdiqlangan savollar yo'q.", "NO_QUESTIONS");
    const byTopic = new Map<string, string[]>();
    for (const q of pool) byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), q.id]);
    const mm = new Map(mastery.map((m) => [m.topicId, m]));
    const plan = allocate(count, [...byTopic].map(([id, list]) => ({ id, cap: list.length, weight: input.distribution === "weak" ? weakWeight(mm.get(id)) : 1 })));
    // Aralash test: mavzular birgalikda keladi (mavzu bo'yicha guruhlanmaydi).
    return shuffle(Object.entries(plan).flatMap(([tid, n]) => unseenFirst(byTopic.get(tid) ?? [], seen).slice(0, n)));
  }

  const [pool, seen] = await Promise.all([db.question.findMany({ where: baseWhere(input), select: { id: true } }), seenIds(userId)]);
  if (pool.length === 0) {
    throw new ApiError(404, input.kind === "situational" ? "Vaziyatli savollar hozircha yo'q." : "Bu mavzuda hozircha tasdiqlangan savollar yo'q.", "NO_QUESTIONS");
  }
  return unseenFirst(pool.map((p) => p.id), seen).slice(0, count);
}

export async function startPractice(userId: string, input: StartInput) {
  const kind = input.kind;
  if (kind === "timed" && !input.durationMin) throw new ApiError(400, "Vaqtli test uchun vaqtni tanlang.");
  if (kind === "mixed" && (input.topicIds?.length ?? 0) < 2) throw new ApiError(400, "Aralash test uchun kamida 2 ta mavzu tanlang.");
  if (kind === "topictest" && input.topicIds?.length !== 1) throw new ApiError(400, "Mavzuli test uchun bitta mavzu tanlang.");
  const requested = input.count ?? defaultCount(kind);
  const ids = await pickIds(userId, input, requested);
  const options = await db.answerOption.findMany({ where: { questionId: { in: ids } }, select: { id: true, questionId: true } });
  const order: Record<string, string[]> = {};
  for (const id of ids) order[id] = shuffle(options.filter((o) => o.questionId === id).map((o) => o.id));
  // Taymer faqat vaqtga mos rejimlarda: vaqtli, mavzuli, aralash va vaziyatli testlarda.
  const durationSec = input.durationMin && ["timed", "topictest", "mixed", "situational"].includes(kind) ? input.durationMin * 60 : null;
  const cfg: PracticeConfig = {
    v: 1, kind, topicIds: input.topicIds ?? [], difficulty: input.difficulty ?? "MIXED", requested, order, hints: {}, reinforce: {},
    policy: policyOf(kind), durationSec, variant: kind === "errors" ? input.variant ?? "old" : null, distribution: kind === "mixed" ? input.distribution ?? "equal" : null,
    skills: input.skills ?? [], answers: {}, flags: {},
  };

  await closeOldSessions(userId);
  const s = await db.testSession.create({
    data: {
      userId, mode: DB_MODE[kind], questionIds: ids, config: asJson(cfg),
      expiresAt: new Date(Date.now() + (durationSec ? durationSec * 1000 + GRACE : 7 * DAY)),
    },
  });
  return { id: s.id, count: ids.length, requested, short: ids.length < requested };
}

/** Faqat eng so'nggi mashq davom ettiriladi. Eskilari yopiladi; yakunda tekshiriladigan testda saqlangan javoblar yo'qolmasligi uchun baholanadi. */
async function closeOldSessions(userId: string) {
  const old = await db.testSession.findMany({ where: { ...engineWhere(userId), status: "IN_PROGRESS" } });
  for (const o of old) {
    if (parseConfig(o.config).policy === "deferred" && Object.keys(parseConfig(o.config).answers).length > 0) await gradeDeferred(o);
    else await db.testSession.updateMany({ where: { id: o.id, status: "IN_PROGRESS" }, data: { status: "EXPIRED" } });
  }
}

/**
 * Oldindan tanlangan savollar bilan sessiya (shaxsiy testlar, aqlli import): mavjud dvigatel, javob yozish va natija qoidalari o'zgarishsiz ishlaydi.
 * Savollar `Question` jadvalida bo'lgani uchun alohida dvigatel yaratilmaydi. Tasdiqlanmagan (DRAFT) savollar mavzu bilimi va xatolar daftariga ta'sir qilmaydi.
 */
export async function startFixedPractice(userId: string, o: { kind: Kind; ids: string[]; topicIds?: string[]; durationMin?: number | null; personal: NonNullable<PracticeConfig["personal"]> }) {
  if (o.ids.length === 0) throw new ApiError(404, "Testda savollar yo'q.");
  const options = await db.answerOption.findMany({ where: { questionId: { in: o.ids } }, select: { id: true, questionId: true } });
  const order: Record<string, string[]> = {};
  for (const id of o.ids) order[id] = shuffle(options.filter((x) => x.questionId === id).map((x) => x.id));
  const durationSec = o.durationMin ? o.durationMin * 60 : null;
  const cfg: PracticeConfig = {
    v: 1, kind: o.kind, topicIds: o.topicIds ?? [], difficulty: "MIXED", requested: o.ids.length, order, hints: {}, reinforce: {},
    policy: policyOf(o.kind), durationSec, variant: null, distribution: null, skills: [], answers: {}, flags: {}, personal: o.personal,
  };
  await closeOldSessions(userId);
  const s = await db.testSession.create({
    data: { userId, mode: DB_MODE[o.kind], questionIds: o.ids, config: asJson(cfg), expiresAt: new Date(Date.now() + (durationSec ? durationSec * 1000 + GRACE : 7 * DAY)) },
  });
  return { id: s.id, kind: o.kind, count: o.ids.length };
}

// ---------- Ko'rinish (davom ettirish uchun ham) ----------
type QWithOptions = Prisma.QuestionGetPayload<{ include: { options: true; topic: { select: { name: true } } } }>;

function orderedOptions(q: QWithOptions, order: string[] | undefined) {
  const byId = new Map(q.options.map((o) => [o.id, o]));
  const seq = (order ?? []).map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
  const rest = q.options.filter((o) => !seq.includes(o)).sort((a, b) => a.position - b.position);
  return [...seq, ...rest];
}

function answerResult(q: QWithOptions, a: { optionId: string | null; isCorrect: boolean; hintUsed: boolean; rationale?: string | null }) {
  return {
    chosenOptionId: a.optionId, isCorrect: a.isCorrect, hintUsed: a.hintUsed,
    correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
    explanation: q.explanation, superKey: q.superKey ?? null, skill: q.skill ?? null, rationale: a.rationale ?? null,
  };
}

export async function practiceView(userId: string, id: string) {
  const s = await loadSession(userId, id);
  const cfg = parseConfig(s.config);
  const ids = s.questionIds as string[];
  const [qs, answers] = await Promise.all([
    db.question.findMany({ where: { id: { in: ids } }, include: { options: true, topic: { select: { name: true } } } }),
    db.userAnswer.findMany({ where: { sessionId: s.id } }),
  ]);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ans = new Map(answers.map((a) => [a.questionId, a]));
  const items = ids.flatMap((qid) => {
    const q = byId.get(qid);
    if (!q) return [];
    const a = ans.get(qid);
    const opts = orderedOptions(q, cfg.order[qid]);
    const rf = cfg.reinforce[qid];
    return [{
      id: q.id, topic: q.topic.name, topicId: q.topicId, difficulty: q.difficulty, text: q.text, sample: q.isDemo || q.source === "SAMPLE", situational: q.kind === "SITUATIONAL",
      options: opts.map((o, i) => ({ id: o.id, label: LABELS[i] ?? String(i + 1), text: o.text })),
      hintOptionId: cfg.hints[qid] ?? null,
      // Yakunda tekshiriladigan rejimlarda tanlov saqlanadi, lekin to'g'ri javob yakunlanguncha yuborilmaydi.
      selectedOptionId: cfg.answers[qid]?.o ?? null, flagged: !!cfg.flags[qid],
      // Javob kaliti faqat javob tekshirilgandan keyin ochiladi.
      answer: a ? answerResult(q, a) : null,
      reinforce: rf ? { questionId: rf.questionId, kind: rf.kind, answered: rf.isCorrect !== null, isCorrect: rf.isCorrect } : null,
    }];
  });
  const answered = cfg.policy === "deferred" && s.status === "IN_PROGRESS" ? items.filter((i) => i.selectedOptionId).length : items.filter((i) => i.answer).length;
  const now = Date.now();
  const endsAt = cfg.durationSec ? s.startedAt.getTime() + cfg.durationSec * 1000 : null;
  return {
    id: s.id, kind: cfg.kind, kindLabel: labelOf(cfg), personal: cfg.personal ?? null, policy: cfg.policy, status: s.status, total: items.length, answered,
    score: items.filter((i) => i.answer?.isCorrect).length, aiAvailable: aiOn(), items,
    // Taymer server vaqti bo'yicha: mijoz faqat qolgan soniyalarni ko'rsatadi.
    timer: endsAt ? { durationSec: cfg.durationSec, remainingSec: Math.max(0, Math.round((endsAt - now) / 1000)) } : null,
  };
}

// ---------- Natijani yozish (mavzu bilimi va xatolar daftari) ----------
type Outcome = { q: { id: string; topicId: string; status: string; source: string; skill: string | null }; isCorrect: boolean };
/** AI yaratgan yoki tasdiqlanmagan savollar mavzu bilimiga va xatolar daftariga ta'sir qilmaydi. */
const affectsMastery = (q: Outcome["q"]) => q.status === "APPROVED" && q.source !== "AI";

async function upsertErrorCards(tx: Tx, userId: string, items: Outcome[], now: Date) {
  const list = items.filter((i) => affectsMastery(i.q));
  if (list.length === 0) return;
  const cards = await tx.errorCard.findMany({ where: { userId, questionId: { in: list.map((i) => i.q.id) } } });
  const byQ = new Map(cards.map((c) => [c.questionId, c]));
  for (const i of list) {
    const card = byQ.get(i.q.id);
    if (!i.isCorrect) {
      const r = nextReview(now, 1, false);
      await tx.errorCard.upsert({
        where: { userId_questionId: { userId, questionId: i.q.id } },
        create: { userId, questionId: i.q.id, nextReviewAt: r.nextReviewAt, intervalDays: r.intervalDays },
        update: { mistakes: { increment: 1 }, mastered: false, nextReviewAt: r.nextReviewAt, intervalDays: r.intervalDays, lastMistakeAt: now },
      });
    } else if (card) {
      const r = nextReview(now, card.intervalDays, true);
      await tx.errorCard.update({ where: { id: card.id }, data: { intervalDays: r.intervalDays, nextReviewAt: r.nextReviewAt, mastered: r.mastered } });
    }
  }
}

async function addMastery(tx: Tx, userId: string, topicId: string, correct: number, total: number) {
  const prev = await tx.topicMastery.findUnique({ where: { userId_topicId: { userId, topicId } } });
  const c = (prev?.correct ?? 0) + correct, t = (prev?.total ?? 0) + total;
  await tx.topicMastery.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId, correct: c, total: t, confidence: confidenceFor(t) },
    update: { correct: c, total: t, confidence: confidenceFor(t) },
  });
}

/** "Yangi vaziyatda sinash": o'sha ko'nikma yangi savolda to'g'ri chiqsa, shu ko'nikmadagi ochiq xatolar takrorlash jadvali bo'yicha oldinga siljiydi. */
async function advanceSkillCards(tx: Tx, userId: string, skill: string, exceptQuestionId: string, now: Date) {
  const cards = await tx.errorCard.findMany({ where: { userId, mastered: false, questionId: { not: exceptQuestionId }, question: { skill } } });
  for (const c of cards) {
    const r = nextReview(now, c.intervalDays, true);
    await tx.errorCard.update({ where: { id: c.id }, data: { intervalDays: r.intervalDays, nextReviewAt: r.nextReviewAt, mastered: r.mastered } });
  }
}

// ---------- Javob berish: darhol tekshiriladigan rejimlar (idempotent) ----------
export async function submitAnswer(userId: string, id: string, questionId: string, optionId: string) {
  const s = await loadSession(userId, id);
  const ids = s.questionIds as string[];
  if (!ids.includes(questionId)) throw new ApiError(404, "Bu savol mashqda yo'q.");
  const cfg = parseConfig(s.config);
  const q = await db.question.findUnique({ where: { id: questionId }, include: { options: true, topic: { select: { name: true } } } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");

  const done = (a: { optionId: string | null; isCorrect: boolean; hintUsed: boolean; rationale?: string | null }, answeredCount: number) => ({
    ...answerResult(q, a), answered: answeredCount, total: ids.length, finished: answeredCount >= ids.length,
  });

  // Takroriy so'rov: oldingi natija qaytariladi, qayta hisoblanmaydi.
  const existing = await db.userAnswer.findUnique({ where: { sessionId_questionId: { sessionId: s.id, questionId } } });
  if (existing) return done(existing, await db.userAnswer.count({ where: { sessionId: s.id } }));
  if (cfg.policy === "deferred") throw new ApiError(409, "Bu rejimda javoblar test yakunlangandan keyin tekshiriladi.");
  if (s.status !== "IN_PROGRESS") throw new ApiError(409, cfg.durationSec ? "Vaqt tugagan yoki mashq yakunlangan." : "Bu mashq yakunlangan.");
  const chosen = q.options.find((o) => o.id === optionId);
  if (!chosen) throw new ApiError(400, "Bunday variant yo'q.");
  const isCorrect = chosen.isCorrect;
  const hintUsed = !!cfg.hints[questionId];
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      await tx.userAnswer.create({ data: { sessionId: s.id, questionId, optionId, isCorrect, hintUsed } });
      if (affectsMastery(q)) {
        await addMastery(tx, userId, q.topicId, isCorrect ? 1 : 0, 1);
        await upsertErrorCards(tx, userId, [{ q, isCorrect }], now);
        if (isCorrect && cfg.kind === "errors" && cfg.variant === "new" && q.skill) await advanceSkillCards(tx, userId, q.skill, questionId, now);
      }
    }, TX);
  } catch (e) {
    // Ikki so'rov bir vaqtda kelgan bo'lsa, ikkinchisi birinchisining natijasini oladi.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const a = await db.userAnswer.findUnique({ where: { sessionId_questionId: { sessionId: s.id, questionId } } });
      if (a) return done(a, await db.userAnswer.count({ where: { sessionId: s.id } }));
    }
    throw e;
  }

  const answeredCount = await db.userAnswer.count({ where: { sessionId: s.id } });
  if (answeredCount >= ids.length) await finalize(s.id, ids.length);
  return done({ optionId, isCorrect, hintUsed }, answeredCount);
}

async function finalize(sessionId: string, totalOverride?: number) {
  const answers = await db.userAnswer.findMany({ where: { sessionId }, select: { isCorrect: true } });
  await db.testSession.updateMany({
    where: { id: sessionId, status: "IN_PROGRESS" },
    data: { status: "SUBMITTED", submittedAt: new Date(), score: answers.filter((a) => a.isCorrect).length, total: totalOverride ?? answers.length },
  });
}

// ---------- Yakunda tekshiriladigan rejimlar: tanlovni saqlash, belgilash, baholash ----------
async function openDeferred(userId: string, id: string, questionId: string) {
  const s = await loadSession(userId, id);
  if (parseConfig(s.config).policy !== "deferred") throw new ApiError(409, "Bu rejimda javoblar darhol tekshiriladi.");
  if (s.status !== "IN_PROGRESS") throw new ApiError(409, "Vaqt tugagan yoki test yakunlangan.");
  if (!(s.questionIds as string[]).includes(questionId)) throw new ApiError(404, "Bu savol testda yo'q.");
  return s;
}

/** Tanlovni atomik saqlaydi (jsonb): tez-tez bosilganda ham boshqa savollarning javobi yo'qolmaydi. optionId=null bo'lsa, tanlov bekor qilinadi. */
export async function saveSelection(userId: string, id: string, questionId: string, optionId: string | null) {
  const s = await openDeferred(userId, id, questionId);
  if (optionId) {
    const ok = await db.answerOption.findFirst({ where: { id: optionId, questionId }, select: { id: true } });
    if (!ok) throw new ApiError(400, "Bunday variant yo'q.");
    await db.$executeRaw`UPDATE "TestSession" SET "config" = jsonb_set(COALESCE("config", '{}'::jsonb), '{answers}', COALESCE("config"->'answers', '{}'::jsonb) || jsonb_build_object(${questionId}::text, jsonb_build_object('o', ${optionId}::text, 't', ${String(Date.now())}::bigint)), true) WHERE "id" = ${s.id} AND "userId" = ${userId} AND "status" = 'IN_PROGRESS'`;
  } else {
    await db.$executeRaw`UPDATE "TestSession" SET "config" = "config" #- ARRAY['answers', ${questionId}::text] WHERE "id" = ${s.id} AND "userId" = ${userId} AND "status" = 'IN_PROGRESS'`;
  }
  return { ok: true as const };
}

export async function setFlag(userId: string, id: string, questionId: string, flagged: boolean) {
  const s = await openDeferred(userId, id, questionId);
  if (flagged) {
    await db.$executeRaw`UPDATE "TestSession" SET "config" = jsonb_set(COALESCE("config", '{}'::jsonb), '{flags}', COALESCE("config"->'flags', '{}'::jsonb) || jsonb_build_object(${questionId}::text, true), true) WHERE "id" = ${s.id} AND "userId" = ${userId} AND "status" = 'IN_PROGRESS'`;
  } else {
    await db.$executeRaw`UPDATE "TestSession" SET "config" = "config" #- ARRAY['flags', ${questionId}::text] WHERE "id" = ${s.id} AND "userId" = ${userId} AND "status" = 'IN_PROGRESS'`;
  }
  return { ok: true as const };
}

/** Saqlangan tanlovlarni bazadagi kalit bo'yicha baholaydi. Takroriy yuborish balni ikki marta hisoblamaydi (holat tranzaksiyada "egallanadi"). */
async function gradeDeferred(s: Session) {
  const cfg = parseConfig(s.config);
  const ids = s.questionIds as string[];
  const qs = await db.question.findMany({ where: { id: { in: ids } }, include: { options: true } });
  const now = new Date();
  await db.$transaction(async (tx) => {
    const claim = await tx.testSession.updateMany({ where: { id: s.id, status: "IN_PROGRESS" }, data: { status: "SUBMITTED", submittedAt: now, total: ids.length } });
    if (claim.count === 0) return;
    const rows: { q: (typeof qs)[number]; optionId: string; isCorrect: boolean; at: number }[] = [];
    for (const q of qs) {
      const sel = cfg.answers[q.id];
      const opt = sel && q.options.find((o) => o.id === sel.o);
      if (sel && opt) rows.push({ q, optionId: opt.id, isCorrect: opt.isCorrect, at: sel.t });
    }
    if (rows.length > 0) await tx.userAnswer.createMany({ data: rows.map((r) => ({ sessionId: s.id, questionId: r.q.id, optionId: r.optionId, isCorrect: r.isCorrect, answeredAt: new Date(r.at) })) });
    await tx.testSession.update({ where: { id: s.id }, data: { score: rows.filter((r) => r.isCorrect).length } });
    const counted = rows.filter((r) => affectsMastery(r.q));
    for (const t of groupByTopic(counted.map((r) => ({ topicId: r.q.topicId, isCorrect: r.isCorrect })))) await addMastery(tx, s.userId, t.topicId, t.correct, t.total);
    await upsertErrorCards(tx, s.userId, counted, now);
  }, TX);
}

// ---------- Ishora (javobni ko'rsatmaydi) ----------
export async function giveHint(userId: string, id: string, questionId: string) {
  const s = await loadSession(userId, id);
  if (parseConfig(s.config).policy === "deferred") throw new ApiError(409, "Bu rejimda ishora berilmaydi.");
  if (s.status !== "IN_PROGRESS") throw new ApiError(409, "Bu mashq yakunlangan.");
  if (!(s.questionIds as string[]).includes(questionId)) throw new ApiError(404, "Bu savol mashqda yo'q.");
  const cfg = parseConfig(s.config);
  if (cfg.hints[questionId]) return { hintOptionId: cfg.hints[questionId] };
  if (await db.userAnswer.findUnique({ where: { sessionId_questionId: { sessionId: s.id, questionId } } })) throw new ApiError(409, "Bu savolga allaqachon javob berilgan.");
  const wrong = await db.answerOption.findMany({ where: { questionId, isCorrect: false }, select: { id: true } });
  if (wrong.length < 2) throw new ApiError(409, "Bu savol uchun ishora yo'q.");
  const pick = shuffle(wrong)[0].id;
  await patchConfig(s.id, (c) => { c.hints[questionId] = pick; });
  return { hintOptionId: pick };
}

// ---------- Yakunlash va natija ----------
export async function finishPractice(userId: string, id: string) {
  const s = await loadSession(userId, id);
  if (s.status === "IN_PROGRESS") {
    const cfg = parseConfig(s.config);
    if (cfg.policy === "deferred") await gradeDeferred(s);
    else {
      const n = await db.userAnswer.count({ where: { sessionId: s.id } });
      if (n === 0) throw new ApiError(400, "Hali birorta savolga javob berilmagan.");
      await finalize(s.id);
    }
  }
  return practiceResult(userId, id);
}

export async function practiceResult(userId: string, id: string) {
  const s = await loadSession(userId, id);
  const cfg = parseConfig(s.config);
  const ids = s.questionIds as string[];
  const answers = await db.userAnswer.findMany({
    where: { sessionId: s.id },
    include: { question: { include: { options: true, topic: { select: { id: true, name: true } } } } },
  });
  const deferred = cfg.policy === "deferred";
  const answered = answers.length, score = answers.filter((a) => a.isCorrect).length;
  // Yakunda tekshiriladigan testlarda javobsiz savollar ham umumiy songa kiradi; darhol tekshiriladigan mashqda yechilganlari bo'yicha.
  const total = deferred ? ids.length : answered;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const m = new Map<string, TopicStat>();
  for (const a of answers) {
    const t = a.question.topic;
    const e = m.get(t.id) ?? { topicId: t.id, name: t.name, correct: 0, total: 0 };
    e.total++; if (a.isCorrect) e.correct++; m.set(t.id, e);
  }
  const stats = [...m.values()];
  const skills = skillStats(answers.map((a) => ({ skill: a.question.skill, isCorrect: a.isCorrect })));
  const wrong = answers.filter((a) => !a.isCorrect).map((a) => ({
    questionId: a.questionId, text: a.question.text, topic: a.question.topic.name, skill: a.question.skill,
    chosen: a.question.options.find((o) => o.id === a.optionId)?.text ?? null,
    correct: a.question.options.find((o) => o.isCorrect)?.text ?? null,
    explanation: a.question.explanation, superKey: a.question.superKey ?? null,
  }));
  const spent = s.submittedAt ? Math.max(0, Math.round((s.submittedAt.getTime() - s.startedAt.getTime()) / 1000)) : null;
  return {
    id: s.id, kind: cfg.kind, kindLabel: labelOf(cfg), personal: cfg.personal ?? null, policy: cfg.policy, status: s.status, score, total, answered, percent, skipped: Math.max(0, ids.length - answered),
    // Savol soni kam bo'lsa, natija taxminiy ekanini ochiq aytamiz.
    approximate: total < 8, headline: headline(percent), topics: stats, skills, ...summarizeTopics(stats), wrong, next: nextStep(stats, wrong.length, skills),
    timing: { spentSec: spent, limitSec: cfg.durationSec, timedOut: !!(cfg.durationSec && spent !== null && spent >= cfg.durationSec) },
    flagged: Object.keys(cfg.flags).length,
    again: { kind: cfg.kind, topicIds: cfg.topicIds, difficulty: cfg.difficulty, count: cfg.requested, durationMin: cfg.durationSec ? Math.round(cfg.durationSec / 60) : null, variant: cfg.variant, distribution: cfg.distribution },
  };
}

// ---------- Tarix (barcha rejimlar, filtrlar bilan) ----------
export type HistoryFilter = { kind?: string; subject?: string; days?: number };

export async function practiceHistory(userId: string, f: HistoryFilter = {}) {
  const since = f.days ? new Date(Date.now() - f.days * DAY) : undefined;
  const list = await db.testSession.findMany({
    where: { userId, OR: [{ ...engineWhere(userId) }, { mode: "DIAGNOSTIC" }], ...(since && { startedAt: { gte: since } }) },
    orderBy: { startedAt: "desc" }, take: 100,
  });
  const ids = list.map((s) => s.id);
  const [counts, subj] = await Promise.all([
    db.userAnswer.groupBy({ by: ["sessionId"], where: { sessionId: { in: ids } }, _count: { _all: true } }),
    db.userAnswer.findMany({ where: { sessionId: { in: ids } }, select: { sessionId: true, question: { select: { topic: { select: { name: true, subject: { select: { name: true } } } } } } } }),
  ]);
  const answered = new Map(counts.map((c) => [c.sessionId, c._count._all]));
  const topics = new Map<string, Set<string>>(), subjects = new Map<string, Set<string>>();
  for (const r of subj) {
    topics.set(r.sessionId, (topics.get(r.sessionId) ?? new Set()).add(r.question.topic.name));
    subjects.set(r.sessionId, (subjects.get(r.sessionId) ?? new Set()).add(r.question.topic.subject.name));
  }
  const rows = list.map((s) => {
    const diag = s.mode === "DIAGNOSTIC";
    const cfg = diag ? null : parseConfig(s.config);
    const kind = diag ? "diagnostic" : cfg!.kind;
    return {
      id: s.id, kind, kindLabel: diag ? "Diagnostika" : labelOf(cfg!), status: s.status, at: s.startedAt,
      score: s.score ?? 0, total: s.total ?? (s.questionIds as string[]).length, answered: answered.get(s.id) ?? 0,
      topics: [...(topics.get(s.id) ?? [])], subjects: [...(subjects.get(s.id) ?? [])],
      spentSec: s.submittedAt ? Math.round((s.submittedAt.getTime() - s.startedAt.getTime()) / 1000) : null,
      // Diagnostika natijasi alohida sahifada ko'rsatilmaydi, shuning uchun havola faqat dvigatel mashqlari uchun.
      reviewable: !diag,
    };
  });
  return rows.filter((r) => (!f.kind || r.kind === f.kind) && (!f.subject || r.subjects.includes(f.subject)));
}

// ---------- Xatolar testi uchun shaxsiy progress ----------
export async function errorsProgress(userId: string) {
  const cards = await db.errorCard.findMany({
    where: { userId }, include: { question: { select: { text: true, skill: true, topic: { select: { name: true } } } } },
  });
  const now = Date.now();
  const open = cards.filter((c) => !c.mastered);
  const repeated = open.filter((c) => c.mistakes >= 2).sort((a, b) => b.mistakes - a.mistakes).slice(0, 3)
    .map((c) => ({ text: c.question.text.slice(0, 120), topic: c.question.topic.name, skill: c.question.skill, mistakes: c.mistakes }));
  const improved = new Map<string, number>();
  for (const c of cards.filter((x) => x.mastered)) improved.set(c.question.topic.name, (improved.get(c.question.topic.name) ?? 0) + 1);
  return {
    open: open.length, mastered: cards.length - open.length,
    due: open.filter((c) => c.nextReviewAt.getTime() <= now).length,
    soon: open.filter((c) => c.nextReviewAt.getTime() > now && c.nextReviewAt.getTime() <= now + 7 * DAY).length,
    repeated, improved: [...improved].map(([topic, n]) => ({ topic, n })),
  };
}

// ---------- Bilim xaritasi 2.0 ----------
export async function knowledgeMap(userId: string) {
  const [topics, mastery, cards, nonEasy] = await Promise.all([
    db.topic.findMany({ where: { subject: { slug: { not: "shaxsiy-testlar" } } }, include: { subject: { select: { name: true } } }, orderBy: { name: "asc" } }),
    db.topicMastery.findMany({ where: { userId } }),
    db.errorCard.findMany({ where: { userId, mastered: false }, select: { question: { select: { topicId: true } } } }),
    db.userAnswer.findMany({ where: { session: { userId }, isCorrect: true, question: { difficulty: { in: ["MEDIUM", "HARD"] } } }, select: { question: { select: { topicId: true } } } }),
  ]);
  const open = new Map<string, number>(), hard = new Map<string, number>();
  for (const c of cards) open.set(c.question.topicId, (open.get(c.question.topicId) ?? 0) + 1);
  for (const a of nonEasy) hard.set(a.question.topicId, (hard.get(a.question.topicId) ?? 0) + 1);
  const mm = new Map(mastery.map((x) => [x.topicId, x]));
  return topics.map((t) => {
    const x = mm.get(t.id);
    const state = masteryState({ total: x?.total ?? 0, correct: x?.correct ?? 0, openErrors: open.get(t.id) ?? 0, nonEasyCorrect: hard.get(t.id) ?? 0 });
    return {
      topicId: t.id, name: t.name, subject: t.subject.name, correct: x?.correct ?? 0, total: x?.total ?? 0, openErrors: open.get(t.id) ?? 0,
      state, label: MASTERY_LABEL[state], hint: MASTERY_HINT[state],
    };
  });
}

// ---------- "Savolda xato bor" ----------
export async function reportQuestion(userId: string, questionId: string, reason: string) {
  const q = await db.question.findUnique({ where: { id: questionId }, select: { id: true } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  const dup = await db.questionReport.findFirst({ where: { userId, questionId } });
  if (dup) return { ok: true, already: true };
  await db.questionReport.create({ data: { userId, questionId, reason: reason.slice(0, 500) } });
  return { ok: true, already: false };
}

export type { Kind };
