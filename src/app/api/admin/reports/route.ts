import { requireAdmin } from "@/server/auth";
import { buildReport } from "@/server/adminstats";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

/** ?type=users|payments|ai|tests|courses&format=json|csv */
export const GET = async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const csv = sp.get("format") === "csv";
  if (!csv) return handle(async () => { await requireAdmin(); return buildReport(sp.get("type") ?? "", "json"); });
  return handle(async () => { await requireAdmin(); return buildReport(sp.get("type") ?? "", "csv"); }).then(async (res) => {
    if (!res.ok) return res;
    const d = (await res.json()) as { csv: string; filename: string };
    return new Response(d.csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${d.filename}"`, "cache-control": "no-store" } });
  });
};
