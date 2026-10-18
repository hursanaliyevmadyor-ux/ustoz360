import { requireAdmin } from "@/server/auth";
import { aiHealth } from "@/server/ai/gateway";
import { webHealth } from "@/server/ai/websearch";
import { audit } from "@/server/audit";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** "Ulanishni sinash": har bir ulangan AI xizmatiga bitta qisqa so'rov. Kalit qaytarilmaydi. */
export const POST = () => handle(async () => {
  const a = await requireAdmin();
  const [r, web] = await Promise.all([aiHealth(), webHealth()]);
  await audit(a.id, "admin.ai_test", { claude: r.claude.ok ?? null, free: r.free.map((f) => f.ok), gemini: web.gemini.ok ?? null });
  return { ...r, web };
});
