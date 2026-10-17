import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { createOrder } from "@/server/payments";
export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("COURSE"), courseId: z.string().min(1).max(60) }),
  z.object({ kind: z.literal("PLAN"), planKey: z.string().min(1).max(20) }),
]);

/** Buyurtma yaratadi. Narx serverda bazadan olinadi; kirish faqat to'lov tasdiqlangandan keyin ochiladi. */
export const POST = (req: Request) => handle(async () => createOrder((await requireUser()).id, body.parse(await req.json())));
