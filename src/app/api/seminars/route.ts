import { listPublicSeminars } from "@/server/admin";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

/** Hamma ko'radigan seminarlar ro'yxati (faqat faol va tugamaganlari). */
export const GET = () => handle(async () => listPublicSeminars());