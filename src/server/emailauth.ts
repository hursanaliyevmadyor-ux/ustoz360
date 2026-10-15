import { ApiError, hashPassword, normalizeEmail, startSession } from "./auth";
import { db } from "./db";
import { consumeCode, issueCode } from "./emailcode";
import { mailConfigured, sendResetCode, sendVerifyCode } from "./mail";

const needMail = () => { if (!mailConfigured()) throw new ApiError(503, "Email yuborish xizmati hali sozlanmagan.", "mail_not_configured"); };

/** 1-qadam: email+parol bilan akkaunt ochadi (hali tasdiqlanmagan) va emailga kod yuboradi. */
export async function startRegistration(rawEmail: string, password: string) {
  needMail();
  const email = normalizeEmail(rawEmail);
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const pending = !user.deletedAt && !user.emailVerifiedAt && !!user.passwordHash;
    if (!pending) {
      throw new ApiError(409, user.passwordHash
        ? "Bu email allaqachon ro'yxatdan o'tgan. Kiring yoki «Parolni unutdim» orqali parolni tiklang."
        : "Bu email boshqa usul (Google) bilan ochilgan. U orqali kiring yoki «Parolni unutdim» orqali parol o'rnating.", "exists");
    }
    // Tasdiqlanmagan akkaunt: parolni yangilab, kodni qayta yuboramiz (egasi emailga kira olsagina tasdiqlay oladi).
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
  } else {
    try {
      await db.user.create({ data: { email, passwordHash: hashPassword(password), roles: { create: { role: "TEACHER" } }, profile: { create: {} } } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan.", "exists");
      throw e;
    }
  }
  await sendVerifyCode(email, await issueCode(email, "verify"));
  return { ok: true as const, email };
}

/** 2-qadam: kodni tasdiqlaydi, emailni tasdiqlangan qiladi va tizimga kiritadi. */
export async function verifyEmail(rawEmail: string, code: string) {
  const email = normalizeEmail(rawEmail);
  await consumeCode(email, "verify", code);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) throw new ApiError(400, "Kod noto'g'ri yoki muddati tugagan.", "bad_code");
  const verified = await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
  await startSession(verified.id);
  await db.auditLog.create({ data: { userId: verified.id, action: "auth.email_verified" } });
  return verified;
}

/** Parolni unutganlar uchun emailga kod yuboradi. Email bazada bor-yo'qligi javobdan bilinmaydi. */
export async function forgotPassword(rawEmail: string) {
  needMail();
  const email = normalizeEmail(rawEmail);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) return { ok: true as const };
  try {
    await sendResetCode(email, await issueCode(email, "reset"));
  } catch (e) {
    // Tez-tez so'rash chegarasi javobda ko'rinmaydi (email mavjudligini oshkor qilmaslik uchun); yuborish xatosi esa ko'rsatiladi.
    if (!(e instanceof ApiError) || (e.code !== "too_soon" && e.code !== "rate_limited")) throw e;
  }
  return { ok: true as const };
}

/** Kod bilan yangi parol o'rnatadi. Barcha eski sessiyalar tugatiladi, noto'g'ri urinishlar hisobi tozalanadi. */
export async function resetPassword(rawEmail: string, code: string, newPassword: string) {
  const email = normalizeEmail(rawEmail);
  await consumeCode(email, "reset", code);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) throw new ApiError(400, "Kod noto'g'ri yoki muddati tugagan.", "bad_code");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
  await db.authSession.deleteMany({ where: { userId: user.id } });
  await db.auditLog.deleteMany({ where: { action: "auth.login_failed", meta: { path: ["email"], equals: email } } });
  await db.auditLog.create({ data: { userId: user.id, action: "auth.password_reset" } });
  return { ok: true as const };
}
