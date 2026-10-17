import { requireUser } from "@/server/auth";
import { listDocs, saveDoc } from "@/server/docs";
import { docInput } from "@/server/docsvalid";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => {
  const u = await requireUser();
  const sp = new URL(req.url).searchParams;
  return listDocs(u.id, { kind: sp.get("kind") ?? undefined, limit: Number(sp.get("limit")) || undefined });
});
export const POST = (req: Request) => handle(async () => saveDoc((await requireUser()).id, docInput.parse(await req.json())));
