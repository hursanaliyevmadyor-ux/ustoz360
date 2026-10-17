import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { cancelPayment } from "@/server/payments";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Foydalanuvchi o'zining hali to'lanmagan buyurtmasini bekor qiladi. */
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => cancelPayment((await params).id, { userId: (await requireUser()).id, admin: false }));
