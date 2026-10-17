import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { askDoc } from "@/server/library";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const u = await requireUser();
  const { question } = z.object({ question: z.string().trim().min(3, "Savolni yozing").max(500) }).parse(await req.json());
  return askDoc(u, (await params).id, question);
});
