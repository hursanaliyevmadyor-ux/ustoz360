import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { createClass, listClasses } from "@/server/sinf";
import { classInput } from "@/server/sinfvalid";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => listClasses((await requireUser()).id));
export const POST = (req: Request) => handle(async () => createClass((await requireUser()).id, classInput.parse(await req.json())));
