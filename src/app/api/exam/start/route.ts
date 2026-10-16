import { z } from "zod";
import { requireUser } from "@/server/auth";
import { startAttempt } from "@/server/exam";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

const body = z.object({ slug: z.string().min(1).max(80) });

export const POST = (req: Request) => handle(async () => startAttempt((await requireUser()).id, body.parse(await req.json()).slug));