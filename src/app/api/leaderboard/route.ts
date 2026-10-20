import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { leaderboard } from "@/server/ranking/service";
export const dynamic = "force-dynamic";

/** ?direction=ALL|<kalit>&page=1&q=nik — ommaviy reyting (faqat nik, avatar, o'rin va indeks; shaxsiy ma'lumot yo'q). */
export const GET = (req: Request) => handle(async () => {
  const u = await requireUser();
  const sp = new URL(req.url).searchParams;
  const d = sp.get("direction");
  return leaderboard(u.id, { direction: !d || d === "ALL" ? null : d.slice(0, 40), page: Math.max(1, Number(sp.get("page")) || 1), q: sp.get("q") ?? undefined });
});
