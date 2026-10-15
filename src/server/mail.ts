import nodemailer from "nodemailer";
import { ApiError } from "./auth";

/**
 * Email yuborish (SMTP). Istalgan SMTP xizmati bilan ishlaydi (Gmail, Brevo, Resend SMTP va h.k.).
 * Kerakli o'zgaruvchilar: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Ixtiyoriy: MAIL_FROM (yo'q bo'lsa SMTP_USER).
 */
export const mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendMail(to: string, subject: string, text: string, html?: string) {
  if (!mailConfigured()) throw new ApiError(503, "Email yuborish xizmati hali sozlanmagan.", "mail_not_configured");
  const port = Number(process.env.SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  const from = process.env.MAIL_FROM || `USTOZ 360 <${process.env.SMTP_USER}>`;
  try {
    await transport.sendMail({ from, to, subject, text, html });
  } catch (e) {
    console.error("Email yuborilmadi", (e as Error).message);
    throw new ApiError(502, "Emailni yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.", "mail_failed");
  }
}

const wrap = (title: string, code: string, note: string) => `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#122B49">
<h2 style="margin:0 0 12px">USTOZ 360</h2><p>${title}</p>
<p style="font-size:32px;font-weight:800;letter-spacing:8px;background:#F5F7FB;border-radius:12px;padding:16px;text-align:center;margin:16px 0">${code}</p>
<p style="color:#5a6b80;font-size:13px">${note}</p></div>`;

export const sendVerifyCode = (to: string, code: string) =>
  sendMail(to, `USTOZ 360: tasdiqlash kodi ${code}`, `USTOZ 360 ro'yxatdan o'tish kodi: ${code}\nKod 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.`,
    wrap("Ro'yxatdan o'tishni tasdiqlash kodi:", code, "Kod 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring."));

export const sendResetCode = (to: string, code: string) =>
  sendMail(to, `USTOZ 360: parolni tiklash kodi ${code}`, `USTOZ 360 parolni tiklash kodi: ${code}\nKod 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring, parolingiz o'zgarmaydi.`,
    wrap("Parolni tiklash kodi:", code, "Kod 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring, parolingiz o'zgarmaydi."));
