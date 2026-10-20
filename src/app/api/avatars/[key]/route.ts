import { NextResponse } from "next/server";
import { ApiError, hasRole, requireUser } from "@/server/auth";
import { readAvatar } from "@/server/ranking/profile";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ key: string }> };

/** Profil rasmi: `me` — o'z rasmi; boshqasi nik kaliti bilan (faqat reytingda qatnashayotgan va yashirilmagan foydalanuvchilar). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const u = await requireUser();
    const { key } = await params;
    if (!/^[a-z0-9]{1,40}$/.test(key) && key !== "me") throw new ApiError(404, "Rasm topilmadi.");
    const img = await readAvatar({ id: u.id, admin: hasRole(u, "ADMIN", "SUPERADMIN") }, key);
    if (!img) throw new ApiError(404, "Rasm topilmadi.");
    return new NextResponse(new Uint8Array(img.bytes), { headers: { "content-type": img.mime, "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("avatar:", (e as Error).message);
    return NextResponse.json({ error: "Ichki xatolik." }, { status: 500 });
  }
}
