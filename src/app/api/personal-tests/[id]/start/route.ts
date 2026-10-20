import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { startCollection, startSchema } from "@/server/import/collections";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Shaxsiy testni mavjud dvigatelda ishga tushiradi: oddiy mashq, mavzuli test yoki diagnostika. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => startCollection(await requireUser(), (await params).id, startSchema.parse(await req.json())));
