import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { saveSettings, settingsBody } from "@/server/ranking/admin";
export const dynamic = "force-dynamic";

/** Reyting sozlamalari (yo'nalishlar, vaznlar, urinishlar, mavsum) va reytingga hisoblanadigan imtihonlar. */
export const PUT = (req: Request) => handle(async () => { const a = await requireAdmin(); return saveSettings(a, settingsBody.parse(await req.json())); });
