import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { defaultPresetId, presetOfPath, presetUrl } from "../../lib/avatars";
import { getSetting } from "../settings";
import type { SettingsMap } from "../settingsdef";
import { prepare, type DiagResult, type ExamMeta, type ExamResult, type Participant, type RankCfg, type RankData } from "./logic";

/**
 * Reyting ma'lumotlari: manba jadvallardan (ExamAttempt, TestSession) to'g'ridan-to'g'ri hisoblanadi, shuning uchun bir natija ikki marta
 * hisoblanmaydi va natija o'zgarsa reyting ham o'zi yangilanadi. Natija 60 soniya keshlanadi (har so'rovda og'ir so'rov yuborilmasin).
 */
export type RankingConfig = SettingsMap["ranking"];
export type RankingSnapshot = { cfg: RankingConfig; rankCfg: RankCfg; data: RankData; participants: Participant[]; exams: ExamMeta[]; at: number };

const TTL_MS = 60_000;
let cache: { key: string; snap: RankingSnapshot } | null = null;
export const invalidateRanking = () => { cache = null; };

export const avatarVersion = (path: string | null | undefined) => (path ? createHash("sha1").update(path).digest("hex").slice(0, 10) : null);

/**
 * Ko'rsatiladigan rasm manzili: tayyor rasm (ommaviy statik fayl), yuklangan rasm (himoyalangan `/api/avatars/<kalit>`) yoki,
 * hech narsa tanlanmagan bo'lsa, foydalanuvchiga avtomatik berilgan tayyor rasm. Shaxsiy ma'lumot oshkor bo'lmaydi.
 */
export const avatarFor = (path: string | null | undefined, userId: string, key: string) => {
  const preset = presetOfPath(path);
  if (preset) return presetUrl(preset);
  return path ? `/api/avatars/${key}?v=${avatarVersion(path)}` : presetUrl(defaultPresetId(userId));
};

export async function loadRanking(): Promise<RankingSnapshot> {
  const cfg = await getSetting("ranking");
  const key = JSON.stringify(cfg);
  if (cache && cache.key === key && Date.now() - cache.snap.at < TTL_MS) return cache.snap;

  const season = cfg.seasonStart ? new Date(`${cfg.seasonStart}T00:00:00Z`) : null;
  const examSeason = season ? Prisma.sql`AND a."startedAt" >= ${season}` : Prisma.empty;
  const diagSeason = season ? Prisma.sql`AND s."submittedAt" >= ${season}` : Prisma.empty;

  const [examRows, diagRows, examMeta, profiles] = await Promise.all([
    // Har foydalanuvchi va imtihon uchun: birinchi `maxAttempts` ta urinishdan eng yaxshisi (qayta topshirib reytingni sun'iy oshirib bo'lmaydi).
    db.$queryRaw<{ userId: string; examId: string; pct: number }[]>`
      SELECT t."userId", t."examId", MAX(t.pct)::float AS pct
      FROM (
        SELECT a."userId", a."examId", (a."score"::float / a."total") AS pct,
               ROW_NUMBER() OVER (PARTITION BY a."userId", a."examId" ORDER BY a."startedAt") AS rn
        FROM "ExamAttempt" a JOIN "Exam" e ON e."id" = a."examId"
        WHERE a."submittedAt" IS NOT NULL AND a."score" IS NOT NULL AND a."total" > 0 AND e."rankingEligible" = true ${examSeason}
      ) t WHERE t.rn <= ${cfg.maxAttempts}
      GROUP BY t."userId", t."examId"`,
    // Diagnostika: oxirgi 3 yakunlangan diagnostikaning o'rtachasi.
    db.$queryRaw<{ userId: string; pct: number; n: number }[]>`
      SELECT t."userId", AVG(t.pct)::float AS pct, COUNT(*)::int AS n
      FROM (
        SELECT s."userId", (s."score"::float / s."total") AS pct,
               ROW_NUMBER() OVER (PARTITION BY s."userId" ORDER BY s."submittedAt" DESC) AS rn
        FROM "TestSession" s
        WHERE s."mode" = 'DIAGNOSTIC' AND s."status" = 'SUBMITTED' AND s."score" IS NOT NULL AND s."total" > 0 ${diagSeason}
      ) t WHERE t.rn <= 3
      GROUP BY t."userId"`,
    db.exam.findMany({ where: { rankingEligible: true }, select: { id: true, title: true, directionKey: true } }),
    db.profile.findMany({
      where: { leaderboardOptIn: true, leaderboardHidden: false, nickname: { not: null }, nicknameNormalized: { not: null }, user: { deletedAt: null } },
      select: { userId: true, nickname: true, nicknameNormalized: true, avatarPath: true, targetExam: true },
    }),
  ]);

  const rankCfg: RankCfg = { examWeight: cfg.examWeight, diagWeight: cfg.diagWeight, minParticipants: cfg.minParticipants, minDiagnostics: cfg.minDiagnostics, directions: cfg.directions };
  const exams: ExamResult[] = examRows.map((r) => ({ userId: r.userId, examId: r.examId, pct: Math.max(0, Math.min(1, r.pct)) }));
  const diag: DiagResult[] = diagRows.map((r) => ({ userId: r.userId, pct: Math.max(0, Math.min(1, r.pct)), count: r.n }));
  const meta = new Map<string, ExamMeta>(examMeta.map((e) => [e.id, e]));
  const participants: Participant[] = profiles.map((p) => ({ userId: p.userId, nickname: p.nickname!, avatar: avatarFor(p.avatarPath, p.userId, p.nicknameNormalized!), direction: p.targetExam }));
  const snap: RankingSnapshot = { cfg, rankCfg, data: prepare(exams, diag, meta, rankCfg), participants, exams: examMeta, at: Date.now() };
  cache = { key, snap };
  return snap;
}
