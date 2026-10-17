import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { getSettings, setSetting } from "@/server/settings";
import { SETTING_KEYS, type SettingKey } from "@/server/settingsdef";
import { integrations } from "@/server/sysstatus";
export const dynamic = "force-dynamic";

/** Sozlamalar + tashqi xizmatlar holati (kalit qiymatlari QAYTARILMAYDI). */
export const GET = () => handle(async () => { await requireAdmin(); return { settings: await getSettings(), integrations: integrations() }; });

export const PUT = (req: Request) => handle(async () => {
  const admin = await requireAdmin();
  const b = z.object({ key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]), value: z.unknown() }).parse(await req.json());
  return { key: b.key, value: await setSetting(b.key, b.value, admin.id) };
});
