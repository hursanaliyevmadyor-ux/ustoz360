import { ApiError } from "../auth";
import { audit } from "../audit";
import { db } from "../db";
import { avatarFor, invalidateRanking, loadRanking, type RankingSnapshot } from "./data";
import { breakdownFor, buildStandings, readiness, type Standing } from "./logic";

type Entry = { rank: number; nickname: string; avatar: string | null; direction: string | null; directionLabel: string | null; index: number; exams: number; isMe: boolean };
const PAGE = 20;

const entryOf = (s: Standing, me: string): Entry => ({
  rank: s.rank, nickname: s.nickname, avatar: s.avatar,
  direction: s.direction, directionLabel: s.directionLabel, index: s.index, exams: s.exams, isMe: s.userId === me,
});

const directionKeys = (snap: RankingSnapshot) => snap.cfg.directions.map((d) => d.key);

/** Reyting jadvali: TOP-3 podium, 4–10-o'rinlar, qolganlari qidiruv va sahifalash bilan (frontendga hammasi birdan yuklanmaydi). */
export async function leaderboard(viewerId: string, o: { direction: string | null; page: number; q?: string }) {
  const snap = await loadRanking();
  if (!snap.cfg.enabled) return { enabled: false as const };
  if (o.direction !== null && !directionKeys(snap).includes(o.direction)) throw new ApiError(404, "Yo'nalish topilmadi.");
  const rows = buildStandings(snap.participants, snap.data, snap.rankCfg, o.direction);
  const q = (o.q ?? "").trim().toLowerCase().slice(0, 30);
  const all = rows.map((r) => entryOf(r, viewerId));
  const list = q ? all.filter((e) => e.nickname.toLowerCase().includes(q)) : all.slice(10);
  const pages = Math.max(1, Math.ceil(list.length / PAGE)), page = Math.min(Math.max(1, o.page), pages);
  const calibratedExams = [...snap.data.cal.exams.values()].filter((s) => s.calibrated).length;
  return {
    enabled: true as const,
    direction: o.direction ?? "ALL", label: o.direction ? snap.cfg.directions.find((d) => d.key === o.direction)?.label ?? o.direction : "Umumiy",
    total: all.length,
    // Hali yetarli ishtirokchi to'planmagan: o'rin hisoblanmaydi (adolatsiz taqqoslash bo'lmasligi uchun)
    calibrating: all.length === 0 && (snap.exams.length === 0 || calibratedExams === 0),
    minParticipants: snap.cfg.minParticipants,
    podium: all.slice(0, 3), top: all.slice(3, 10),
    list: { items: list.slice((page - 1) * PAGE, page * PAGE), page, pages, total: list.length, q },
  };
}

/** Foydalanuvchining shaxsiy reyting holati: o'rni, indeks, shaxsiy natijalari va keyingi qadam (reytingda bo'lmasa — aniq sabab). */
export async function myRanking(userId: string) {
  const snap = await loadRanking();
  const prof = await db.profile.findUnique({ where: { userId }, select: { nickname: true, nicknameNormalized: true, avatarPath: true, targetExam: true, leaderboardOptIn: true, leaderboardHidden: true } });
  const direction = prof?.targetExam && directionKeys(snap).includes(prof.targetExam) ? prof.targetExam : null;
  const bAll = breakdownFor(userId, null, snap.data);
  const bDir = direction ? breakdownFor(userId, direction, snap.data) : null;
  const ready = readiness({ optIn: !!prof?.leaderboardOptIn, hasNickname: !!prof?.nickname, hidden: !!prof?.leaderboardHidden, b: bAll, cfg: snap.rankCfg, calibratedExamExists: snap.exams.length > 0 });

  const find = (dir: string | null) => {
    const rows = buildStandings(snap.participants, snap.data, snap.rankCfg, dir);
    const mine = rows.find((r) => r.userId === userId);
    return mine ? { rank: mine.rank, total: rows.length, index: mine.index, exams: mine.exams } : null;
  };
  const overall = ready.ready ? find(null) : null;
  const inDirection = ready.ready && direction ? find(direction) : null;

  // Shaxsiy natijalar (reytingdan qat'i nazar saqlanadi): imtihonlar bo'yicha eng yaxshi natija
  const mineExams = (snap.data.examsByUser.get(userId) ?? []).map((r) => ({ title: snap.exams.find((e) => e.id === r.examId)?.title ?? "Imtihon", percent: Math.round(r.pct * 100), counted: !!snap.data.cal.exams.get(r.examId)?.calibrated }));
  const diag = snap.data.diagByUser.get(userId) ?? null;

  const step = !prof?.nickname ? { text: "Nik tanlang", href: "/profil#reyting" }
    : !prof.leaderboardOptIn ? { text: "Reytingda qatnashishga rozilik bering", href: "/profil#reyting" }
    : bAll.diagnostics < snap.rankCfg.minDiagnostics ? { text: "Diagnostikani yakunlang", href: "/ustoz-ai/diagnostika" }
    : bAll.examsTaken === 0 ? { text: "Imtihon simulyatorini topshiring", href: "/imtihon" }
    : null;

  return {
    enabled: snap.cfg.enabled,
    nickname: prof?.nickname ?? null,
    avatar: avatarFor(prof?.avatarPath, userId, "me"),
    optIn: !!prof?.leaderboardOptIn, hidden: !!prof?.leaderboardHidden,
    direction, directionLabel: direction ? snap.cfg.directions.find((d) => d.key === direction)?.label ?? direction : null,
    ranked: ready.ready && !!overall,
    overall, inDirection,
    index: overall?.index ?? inDirection?.index ?? null,
    counted: { exams: bAll.examsUsed, diagnostics: bAll.diagnostics },
    blockers: ready.reasons,
    // Reytingga kirish sharti bajarilgan, lekin hali o'rin yo'q: taqqoslash uchun ishtirokchilar yetarli emas
    comparing: ready.ready && !overall,
    nextStep: step,
    personal: { exams: mineExams.slice(0, 6), diagnosticPercent: diag ? Math.round(diag.pct * 100) : null, diagnostics: diag?.count ?? 0 },
    minParticipants: snap.cfg.minParticipants,
  };
}

export async function directionsInfo() {
  const snap = await loadRanking();
  return {
    enabled: snap.cfg.enabled,
    directions: [{ key: "ALL", label: "Umumiy", count: buildStandings(snap.participants, snap.data, snap.rankCfg, null).length }, ...snap.cfg.directions.map((d) => ({ key: d.key, label: d.label, count: buildStandings(snap.participants, snap.data, snap.rankCfg, d.key).length }))],
  };
}

export async function seasonInfo() {
  const snap = await loadRanking();
  return { current: snap.cfg.seasonStart ? { start: snap.cfg.seasonStart, label: `${snap.cfg.seasonStart} dan` } : { start: null, label: "Barcha vaqt" }, maxAttempts: snap.cfg.maxAttempts };
}

/** Reytingda qatnashishga rozilik (ixtiyoriy). Rozilik berish uchun nik kerak; chiqilganda shaxsiy natijalar saqlanib qoladi. */
export async function setParticipation(userId: string, optIn: boolean) {
  const prof = await db.profile.findUnique({ where: { userId }, select: { nickname: true } });
  if (optIn && !prof?.nickname) throw new ApiError(400, "Avval reytingda ko'rinadigan nik tanlang.", "nickname_required");
  await db.profile.upsert({ where: { userId }, create: { userId, leaderboardOptIn: optIn, leaderboardOptInAt: optIn ? new Date() : null }, update: { leaderboardOptIn: optIn, leaderboardOptInAt: optIn ? new Date() : null } });
  invalidateRanking();
  await audit(userId, optIn ? "ranking.opt_in" : "ranking.opt_out");
  return { optIn };
}
