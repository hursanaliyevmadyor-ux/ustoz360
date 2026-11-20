/**
 * Xona rejimlari (havolada va imzoda bitta harf):
 *   s = video dars, o'quvchi qo'l ko'taradi, ustoz gapirishga ruxsat beradi
 *   e = video, erkin suhbat (hamma mikrofon va kamerani yoqa oladi)
 *   q = ovozli chat (kamerasiz), qo'l ko'tarish va ustoz ruxsati bilan
 *   o = ovozli chat (kamerasiz), hamma gapira oladi
 * Toza funksiyalar: server ham, brauzer ham ishlatadi.
 */
export const VOICE_MODES = ["s", "e", "q", "o"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];
export const isVoiceMode = (v: unknown): v is VoiceMode => typeof v === "string" && (VOICE_MODES as readonly string[]).includes(v);

/** Kamera va ekran ulashish bormi (video rejimlar). */
export const hasVideo = (m: VoiceMode): boolean => m === "s" || m === "e";
/** Hamma ruxsatsiz gapira oladimi. */
export const isFree = (m: VoiceMode): boolean => m === "e" || m === "o";

/** Rejimni ikki tanlovdan hosil qiladi: video yoki kamerasiz, erkin yoki ruxsat bilan. */
export const modeOf = (video: boolean, free: boolean): VoiceMode => (video ? (free ? "e" : "s") : free ? "o" : "q");

export const modeLabel = (m: VoiceMode): string =>
  m === "s" ? "Video dars (ruxsat bilan)" : m === "e" ? "Video dars (erkin)" : m === "q" ? "Ovozli chat (ruxsat bilan)" : "Ovozli chat (erkin)";
