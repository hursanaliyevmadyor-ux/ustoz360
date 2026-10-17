import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { authorCourses, requireAuthor, saveCourse } from "@/server/market";
import { courseInput } from "@/server/marketvalid";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { const u = await requireUser(); requireAuthor(u); return authorCourses(u.id); });
export const POST = (req: Request) => handle(async () => { const u = await requireUser(); requireAuthor(u); return saveCourse(u.id, courseInput.parse(await req.json())); });
