import { NextResponse } from "next/server";
import { ApiError, hasRole, requireUser } from "@/server/auth";
import { readFigure, sniffImage } from "@/server/import/figures";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ owner: string; name: string }> };

/**
 * Savoldagi rasm. Egasining shaxsiy savollari faqat egasiga (va adminga) ko'rinadi; admin tasdiqlagan umumiy savollarning rasmlari (`global`)
 * barcha kirgan foydalanuvchilarga. Yo'l tekshiriladi, shuning uchun boshqa fayllarga chiqib bo'lmaydi.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const u = await requireUser();
    const { owner, name } = await params;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,160}$/.test(name)) throw new ApiError(404, "Rasm topilmadi.");
    if (owner !== "global" && owner !== u.id && !hasRole(u, "ADMIN", "SUPERADMIN")) throw new ApiError(404, "Rasm topilmadi.");
    const bytes = await readFigure(owner, name);
    if (!bytes) throw new ApiError(404, "Rasm topilmadi.");
    return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": sniffImage(bytes) ?? "image/png", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("figure:", (e as Error).message);
    return NextResponse.json({ error: "Ichki xatolik." }, { status: 500 });
  }
}
