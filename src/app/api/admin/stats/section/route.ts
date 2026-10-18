import { requireAdmin } from "@/server/auth";
import { buildSection } from "@/server/adminsections";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ?name=users|admins|ustoz-ai|darsyor|toifa|sinf|market|bilimxona|ai|seminarlar&days=7|30|90 : yig'ma statistika (shaxsiy ma'lumotsiz). */
export const GET = (req: Request) => handle(async () => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  return buildSection(sp.get("name") ?? "", Number(sp.get("days")) || 30);
});
