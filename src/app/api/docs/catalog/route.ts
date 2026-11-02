import { requireUser } from "@/server/auth";
import { listCatalog } from "@/server/docs";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

/** Tayyor hujjatlar katalogi (faqat o'qish). Admin tasdiqlagan hujjatlar; foydalanuvchi o'z nusxasini /api/docs orqali saqlaydi. */
export const GET = (req: Request) => handle(async () => {
  await requireUser();
  return listCatalog({ kind: new URL(req.url).searchParams.get("kind") ?? undefined });
});
