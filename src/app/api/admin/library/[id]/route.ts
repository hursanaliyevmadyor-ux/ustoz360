import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteDoc, reviewLibrary } from "@/server/library";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Ommaviy qilish so'rovini tasdiqlash yoki rad etish. */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const a = await requireAdmin();
  const { action } = z.object({ action: z.enum(["approve", "reject"]) }).parse(await req.json());
  return reviewLibrary(a.id, (await params).id, action);
});
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deleteDoc(await requireAdmin(), (await params).id));
