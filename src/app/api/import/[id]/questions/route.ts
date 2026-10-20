import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { listQuestions } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (req: Request, { params }: Ctx) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  return listQuestions(await requireUser(), (await params).id, { filter: sp.get("filter") ?? undefined, fileId: sp.get("fileId") ?? undefined, page: Math.max(1, Number(sp.get("page")) || 1) });
});
