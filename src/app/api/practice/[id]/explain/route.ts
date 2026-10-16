import { requireUser } from "@/server/auth";
import { explain, explainInput } from "@/server/coach";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const user = await requireUser();
  return explain(user.id, (await params).id, explainInput.parse(await req.json()));
});
