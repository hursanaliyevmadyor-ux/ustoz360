import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { saveCollection, saveSchema } from "@/server/import/collections";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** Tasdiqlangan savollarni «Mening testlarim» ga saqlaydi. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => saveCollection(await requireUser(), (await params).id, saveSchema.parse(await req.json().catch(() => ({})))));
