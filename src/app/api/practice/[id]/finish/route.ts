import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { finishPractice, practiceResult } from "@/server/practice";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST: mashqni yakunlaydi (takroriy so'rovda natijani qaytaradi). GET: tugagan mashq natijasi. */
export const POST = (_r: Request, { params }: Ctx) => handle(async () => finishPractice((await requireUser()).id, (await params).id));
export const GET = (_r: Request, { params }: Ctx) => handle(async () => practiceResult((await requireUser()).id, (await params).id));
