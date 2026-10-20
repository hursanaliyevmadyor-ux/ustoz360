import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "../auth";
import { audit } from "../audit";
import { db } from "../db";
import { storage } from "../storage";
import { getSetting } from "../settings";
import { PRESET_PREFIX, defaultPresetId, isPresetId, presetOfPath, type AvatarState } from "../../lib/avatars";
import { avatarFor, invalidateRanking } from "./data";
import { sanitizeAvatar } from "./imagemeta";
import { checkNickname } from "./nickname";

/** Profil 2.0: nik (yagona), profil rasmi (Supabase Storage, metadata tozalangan) va reyting yo'nalishi. Foydalanuvchi faqat o'z profilini o'zgartiradi. */
const avatarKey = (userId: string, ext: string) => `avatars/${userId}/${randomBytes(8).toString("hex")}.${ext}`;

export async function checkNickAvailable(userId: string, raw: string) {
  const c = checkNickname(raw);
  if (!c.ok) return { available: false as const, message: c.error, code: c.code };
  const taken = await db.profile.findFirst({ where: { nicknameNormalized: c.normalized, NOT: { userId } }, select: { userId: true } });
  return taken ? { available: false as const, message: "Bu nik band.", code: "taken" } : { available: true as const, message: "Bu nik mavjud (bo'sh): tanlashingiz mumkin.", code: "free" };
}

export async function setNickname(userId: string, raw: string) {
  const c = checkNickname(raw);
  if (!c.ok) throw new ApiError(400, c.error, c.code);
  const taken = await db.profile.findFirst({ where: { nicknameNormalized: c.normalized, NOT: { userId } }, select: { userId: true } });
  if (taken) throw new ApiError(409, "Bu nik band.", "taken");
  try {
    await db.profile.upsert({ where: { userId }, create: { userId, nickname: c.nickname, nicknameNormalized: c.normalized }, update: { nickname: c.nickname, nicknameNormalized: c.normalized } });
  } catch (e) {
    // Bir vaqtda bir xil nikni olishga urinish: bazadagi yagonalik indeksi himoya qiladi.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ApiError(409, "Bu nik band.", "taken");
    throw e;
  }
  invalidateRanking();
  await audit(userId, "profile.nickname", { nickname: c.nickname });
  return { nickname: c.nickname };
}

export async function saveAvatar(userId: string, bytes: Uint8Array) {
  const st = storage();
  if (!st.configured()) throw new ApiError(503, "Fayl saqlash xizmati ulanmagan: profil rasmini hozir yuklab bo'lmaydi.", "storage_unconfigured");
  const r = sanitizeAvatar(bytes);
  if (!r.ok) throw new ApiError(400, r.error, "bad_image");
  const prev = await db.profile.findUnique({ where: { userId }, select: { avatarPath: true } });
  const path = avatarKey(userId, r.image.ext);
  await st.put(path, r.image.bytes, r.image.mime);
  await db.profile.upsert({ where: { userId }, create: { userId, avatarPath: path }, update: { avatarPath: path } });
  await dropUpload(prev?.avatarPath);
  invalidateRanking();
  await audit(userId, "profile.avatar_set", { bytes: r.image.bytes.length, width: r.image.width, height: r.image.height });
  return { avatar: avatarFor(path, userId, "me"), avatarCustom: true, avatarPreset: null, avatarIsDefault: false } satisfies AvatarState;
}

/** Yuklangan rasm fayli bo'lsa (tayyor rasm emas), uni xotiradan o'chiradi. */
async function dropUpload(path: string | null | undefined) {
  if (!path || presetOfPath(path)) return;
  const st = storage();
  if (st.configured()) await st.remove(path).catch(() => undefined);
}

/** Tayyor rasmlardan birini tanlash (yuklangan o'z rasmi bo'lsa, u o'chiriladi). */
export async function choosePreset(userId: string, id: string) {
  if (!isPresetId(id)) throw new ApiError(400, "Bunday tayyor rasm yo'q.");
  const prev = await db.profile.findUnique({ where: { userId }, select: { avatarPath: true } });
  const path = `${PRESET_PREFIX}${id}`;
  await db.profile.upsert({ where: { userId }, create: { userId, avatarPath: path }, update: { avatarPath: path } });
  await dropUpload(prev?.avatarPath);
  invalidateRanking();
  await audit(userId, "profile.avatar_preset", { preset: id });
  return { avatar: avatarFor(path, userId, "me"), avatarCustom: false, avatarPreset: id, avatarIsDefault: false } satisfies AvatarState;
}

/** «Standart rasmga qaytish»: tanlangan/yuklangan rasm olib tashlanadi va foydalanuvchiga avtomatik rasm ko'rinadi. */
export async function removeAvatar(userId: string) {
  const prof = await db.profile.findUnique({ where: { userId }, select: { avatarPath: true } });
  if (prof?.avatarPath) {
    await db.profile.update({ where: { userId }, data: { avatarPath: null } });
    await dropUpload(prof.avatarPath);
    invalidateRanking();
    await audit(userId, "profile.avatar_remove");
  }
  return { avatar: avatarFor(null, userId, "me"), avatarCustom: false, avatarPreset: defaultPresetId(userId), avatarIsDefault: true } satisfies AvatarState;
}

/** Rasmni berish: o'ziga (`me`) har doim; boshqalarga faqat reytingda qatnashayotgan va yashirilmagan foydalanuvchining rasmi (yoki admin). */
export async function readAvatar(viewer: { id: string; admin: boolean }, key: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const where = key === "me" ? { userId: viewer.id } : { nicknameNormalized: key };
  const p = await db.profile.findFirst({ where, select: { userId: true, avatarPath: true, leaderboardOptIn: true, leaderboardHidden: true } });
  if (!p?.avatarPath || presetOfPath(p.avatarPath)) return null; // tayyor rasmlar ommaviy statik fayl sifatida beriladi
  const visible = p.userId === viewer.id || viewer.admin || (p.leaderboardOptIn && !p.leaderboardHidden);
  if (!visible) return null;
  const st = storage();
  if (!st.configured()) return null;
  try {
    const bytes = await st.get(p.avatarPath);
    const ext = p.avatarPath.split(".").pop();
    return { bytes, mime: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg" };
  } catch { return null; }
}

/** Profilda tanlanadigan yo'nalish: sozlamalardagi (admin boshqaradigan) yo'nalishlar. */
export async function allowedDirections() {
  return (await getSetting("ranking")).directions;
}
