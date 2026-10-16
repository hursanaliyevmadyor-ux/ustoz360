import { requireAdmin } from "@/server/auth";
import { createTopic } from "@/server/admin";
import { topicInput } from "@/server/adminvalid";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => handle(async () => { await requireAdmin(); const b = topicInput.parse(await req.json()); return createTopic(b.subjectId, b.name); });