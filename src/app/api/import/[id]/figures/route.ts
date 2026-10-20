import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { pendingFigures } from "@/server/import/figures";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Tasdiqlangan savollardagi rasm joylari: brauzer hali yuklanmaganlarini asl sahifadan kesib yuboradi. */
export const GET = (_r: Request, { params }: Ctx) => handle(async () => pendingFigures((await requireUser()).id, (await params).id));
