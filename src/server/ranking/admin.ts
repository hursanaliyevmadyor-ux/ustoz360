import { z } from "zod";
import { ApiError } from "../auth";
import { audit } from "../audit";
import { db } from "../db";
import { getSetting, setSetting } from "../settings";
import { settingSchemas } from "../settingsdef";
import { invalidateRanking, loadRanking } from "./data";
import { buildStandings } from "./logic";
import { storage } from "../storage";
import { presetOfPath } from "../../lib/avatars";

/** Reyting boshqaruvi (admin): sozlamalar, reytingga hisoblanadigan imtihonlar, qayta hisoblash va nik/avatar moderatsiyasi. Har amal audit jurnaliga yoziladi. */
type Admin = { id: string };

export async function overview(q?: string) {
  const [settings, exams, participants, snap] = await Promise.all([
    getSetting("ranking"),
    db.exam.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, title: true, subject: true, active: true, directionKey: true, rankingEligible: true, _count: { select: { attempts: true } } } }),
    db.profile.findMany({
      where: { nickname: { not: null }, ...(q?.trim() && { nickname: { contains: q.trim().slice(0, 30), mode: "insensitive" as const } }) },
      orderBy: { nickname: "asc" }, take: 50,
      select: { userId: true, nickname: true, avatarPath: true, targetExam: true, leaderboardOptIn: true, leaderboardHidden: true, user: { select: { name: true, email: true } } },
    }),
    loadRanking(),
  ]);
  const stats = [...snap.data.cal.exams.entries()].map(([examId, s]) => ({ examId, n: s.n, calibrated: s.calibrated }));
  return {
    settings,
    exams: exams.map((e) => ({ id: e.id, title: e.title, subject: e.subject, active: e.active, directionKey: e.directionKey, rankingEligible: e.rankingEligible, attempts: e._count.attempts, ...stats.find((s) => s.examId === e.id) && { participants: stats.find((s) => s.examId === e.id)!.n, calibrated: stats.find((s) => s.examId === e.id)!.calibrated } })),
    diagnostics: { participants: snap.data.cal.diag.n, calibrated: snap.data.cal.diag.calibrated },
    standings: buildStandings(snap.participants, snap.data, snap.rankCfg, null).length,
    optedIn: snap.participants.length,
    participants: participants.map((p) => ({ userId: p.userId, nickname: p.nickname, name: p.user.name ?? p.user.email ?? "—", hasAvatar: !!p.avatarPath && !presetOfPath(p.avatarPath), direction: p.targetExam, optIn: p.leaderboardOptIn, hidden: p.leaderboardHidden })),
  };
}

const examPatch = z.object({ id: z.string().min(1), rankingEligible: z.boolean().optional(), directionKey: z.string().nullable().optional() });
export const settingsBody = z.object({ settings: z.unknown().optional(), exams: z.array(examPatch).max(200).optional() });

export async function saveSettings(admin: Admin, body: z.infer<typeof settingsBody>) {
  let saved = await getSetting("ranking");
  if (body.settings !== undefined) {
    const parsed = settingSchemas.ranking.safeParse(body.settings);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Sozlama qiymati noto'g'ri.");
    if (parsed.data.examWeight + parsed.data.diagWeight <= 0) throw new ApiError(400, "Vaznlar yig'indisi 0 dan katta bo'lsin.");
    const keys = new Set(parsed.data.directions.map((d) => d.key));
    if (keys.size !== parsed.data.directions.length) throw new ApiError(400, "Yo'nalish kalitlari takrorlanmasin.");
    saved = await setSetting("ranking", parsed.data, admin.id);
  }
  if (body.exams?.length) {
    const keys = new Set(saved.directions.map((d) => d.key));
    for (const e of body.exams) {
      if (e.directionKey && !keys.has(e.directionKey)) throw new ApiError(400, `Noma'lum yo'nalish: ${e.directionKey}`);
      const r = await db.exam.updateMany({ where: { id: e.id }, data: { ...(e.rankingEligible !== undefined && { rankingEligible: e.rankingEligible }), ...(e.directionKey !== undefined && { directionKey: e.directionKey }) } });
      if (!r.count) throw new ApiError(404, "Imtihon topilmadi.");
    }
    await audit(admin.id, "ranking.exams", { exams: body.exams });
  }
  invalidateRanking();
  return { ok: true as const, settings: saved };
}

export async function recalculate(admin: Admin) {
  invalidateRanking();
  const snap = await loadRanking();
  await audit(admin.id, "ranking.recalculate");
  return { ok: true as const, standings: buildStandings(snap.participants, snap.data, snap.rankCfg, null).length, participants: snap.participants.length };
}

export const moderateBody = z.object({ userId: z.string().min(1), action: z.enum(["hide", "unhide", "reset_nickname", "remove_avatar"]) });
export async function moderate(admin: Admin, input: z.infer<typeof moderateBody>) {
  const p = await db.profile.findUnique({ where: { userId: input.userId }, select: { avatarPath: true } });
  if (!p) throw new ApiError(404, "Foydalanuvchi topilmadi.");
  if (input.action === "hide" || input.action === "unhide") await db.profile.update({ where: { userId: input.userId }, data: { leaderboardHidden: input.action === "hide" } });
  else if (input.action === "reset_nickname") await db.profile.update({ where: { userId: input.userId }, data: { nickname: null, nicknameNormalized: null, leaderboardOptIn: false } });
  else {
    await db.profile.update({ where: { userId: input.userId }, data: { avatarPath: null } });
    if (p.avatarPath && !presetOfPath(p.avatarPath) && storage().configured()) await storage().remove(p.avatarPath).catch(() => undefined);
  }
  invalidateRanking();
  await audit(admin.id, `ranking.moderate.${input.action}`, { target: input.userId });
  return { ok: true as const };
}
