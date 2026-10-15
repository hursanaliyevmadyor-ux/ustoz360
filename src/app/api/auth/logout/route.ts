import { logout } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
export const POST = () => handle(async () => { await logout(); return { ok: true }; });
