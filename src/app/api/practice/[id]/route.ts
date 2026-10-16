import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { practiceView } from "@/server/practice";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => practiceView((await requireUser()).id, (await params).id));
