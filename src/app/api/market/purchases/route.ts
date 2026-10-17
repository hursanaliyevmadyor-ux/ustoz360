import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { myPurchases } from "@/server/payments";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => myPurchases((await requireUser()).id));
