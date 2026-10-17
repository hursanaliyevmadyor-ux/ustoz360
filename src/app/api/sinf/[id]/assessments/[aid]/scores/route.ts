import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { saveScores } from "@/server/sinf";
import { scoresInput } from "@/server/sinfvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; aid: string }> };

/** Body: { scores: { [studentId]: ball | null } }. null natijani o'chiradi. */
export const PUT = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return saveScores((await requireUser()).id, p.id, p.aid, scoresInput.parse(await req.json()).scores); });
