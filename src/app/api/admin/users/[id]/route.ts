import { requireAdmin } from "@/server/auth";
import { updateUser, userUpdateInput } from "@/server/adminusers";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Rollar, bloklash, tarif berish. Har bir o'zgarish audit jurnaliga yoziladi. */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const admin = await requireAdmin();
  return updateUser(admin, (await params).id, userUpdateInput.parse(await req.json()));
});
