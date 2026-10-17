import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { addStudents } from "@/server/sinf";
import { aliasesInput } from "@/server/sinfvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Body: { aliases: string[] }. O'quvchilar faqat taxallus bilan; takroriy taxalluslar o'tkazib yuboriladi. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => addStudents((await requireUser()).id, (await params).id, aliasesInput.parse(await req.json()).aliases));
