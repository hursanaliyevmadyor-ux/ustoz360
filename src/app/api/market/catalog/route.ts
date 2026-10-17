import { currentUser } from "@/server/auth";
import { handle } from "@/server/http";
import { catalog } from "@/server/market";
import { catalogQuery } from "@/server/marketvalid";
import { getSetting } from "@/server/settings";
export const dynamic = "force-dynamic";

/** Katalog hamma uchun ochiq; kirgan foydalanuvchiga "sizda bor" belgisi qo'shiladi. */
export const GET = (req: Request) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  const q = catalogQuery.parse({ q: sp.get("q") ?? undefined, subject: sp.get("subject") ?? undefined, sort: sp.get("sort") ?? undefined });
  const u = await currentUser();
  const [data, pay] = await Promise.all([catalog(u?.id ?? null, q), getSetting("payments")]);
  return { ...data, paymentsMode: pay.mode, loggedIn: !!u };
});
