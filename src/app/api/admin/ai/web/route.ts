import { requireAdmin } from "@/server/auth";
import { webStats } from "@/server/ai/websearch";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

/** Admin: internet qidiruvi holati: Tavily ulanishi, sarflangan kreditlar, kesh va limitlar. Kalit qaytarilmaydi. */
export const GET = () => handle(async () => { await requireAdmin(); return webStats(); });
