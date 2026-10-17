import { Prisma } from "@prisma/client";
import { ApiError } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { mergeSetting, SETTING_KEYS, settingSchemas, type SettingKey, type SettingsMap } from "./settingsdef";

const TTL_MS = 30_000;
let cache: { at: number; map: SettingsMap } | null = null;
export const clearSettingsCache = () => { cache = null; };

/** Barcha sozlamalar (30 soniya keshlanadi: har so'rovda bazaga bormaslik uchun). Baza ishlamasa standart qiymatlar. */
export async function getSettings(): Promise<SettingsMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  let rows: { key: string; value: unknown }[] = [];
  try { rows = await db.siteSetting.findMany(); } catch (e) { console.error("settings", (e as Error).message); if (cache) return cache.map; }
  const by = new Map(rows.map((r) => [r.key, r.value]));
  const map = Object.fromEntries(SETTING_KEYS.map((k) => [k, mergeSetting(k, by.get(k))])) as SettingsMap;
  cache = { at: Date.now(), map };
  return map;
}
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> { return (await getSettings())[key]; }

export async function setSetting<K extends SettingKey>(key: K, value: unknown, adminId: string) {
  if (!SETTING_KEYS.includes(key)) throw new ApiError(400, "Noma'lum sozlama.");
  const parsed = settingSchemas[key].safeParse(value);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Sozlama qiymati noto'g'ri.");
  await db.siteSetting.upsert({ where: { key }, create: { key, value: parsed.data as Prisma.InputJsonValue, updatedBy: adminId }, update: { value: parsed.data as Prisma.InputJsonValue, updatedBy: adminId } });
  clearSettingsCache();
  await audit(adminId, "admin.setting", { key });
  return parsed.data as SettingsMap[K];
}

/** Hamma ko'radigan qism: modullar yoqilganligi, sayt nomi, to'lov rejimi. Maxfiy hech narsa yo'q. */
export async function publicSettings() {
  const s = await getSettings();
  return { siteName: s.general.siteName, supportContact: s.general.supportContact, modules: s.modules, paymentsMode: s.payments.mode, aiDisclaimer: s.content.aiDisclaimer };
}
