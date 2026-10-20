/**
 * Tayyor profil rasmlari (public/avatars/p1.svg … p10.svg): original multfilm qahramonlari, real odam rasmi emas.
 * Foydalanuvchi rasm tanlamagan bo'lsa, unga identifikatori bo'yicha doimiy (har safar bir xil) rasm beriladi;
 * tanlangan tayyor rasm `Profile.avatarPath` da `preset:pN` ko'rinishida saqlanadi (bazaga yangi ustun kerak emas).
 */
export const AVATAR_PRESETS = [
  { id: "p1", name: "Bilimdon boyqush" },
  { id: "p2", name: "Do'st robot" },
  { id: "p3", name: "Sehrgar" },
  { id: "p4", name: "Zukko tulki" },
  { id: "p5", name: "Kosmik mushuk" },
  { id: "p6", name: "Kichik ajdar" },
  { id: "p7", name: "O'rmon elfi" },
  { id: "p8", name: "Pingvin professor" },
  { id: "p9", name: "Kitobxon ayiqcha" },
  { id: "p10", name: "Jasur ritsar" },
] as const;

/** Profil rasmi holati (profil sahifasi va rasm amallari javoblari). `avatarIsDefault`: foydalanuvchi hali o'zi tanlamagan, avtomatik rasm. */
export type AvatarState = { avatar: string; avatarCustom: boolean; avatarPreset: string | null; avatarIsDefault: boolean };

export const PRESET_PREFIX = "preset:";
export const presetUrl = (id: string) => `/avatars/${id}.svg`;
export const isPresetId = (id: string) => AVATAR_PRESETS.some((p) => p.id === id);

/** Saqlangan yo'ldagi tayyor rasm identifikatori; yuklangan rasm yoki bo'sh bo'lsa `null`. */
export function presetOfPath(path: string | null | undefined): string | null {
  if (!path?.startsWith(PRESET_PREFIX)) return null;
  const id = path.slice(PRESET_PREFIX.length);
  return isPresetId(id) ? id : null;
}

/** Foydalanuvchi o'zi tanlamagan bo'lsa beriladigan rasm: identifikatordan (FNV-1a) hisoblanadi, shuning uchun hamma joyda bir xil. */
export function defaultPresetId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return AVATAR_PRESETS[(h >>> 0) % AVATAR_PRESETS.length].id;
}
