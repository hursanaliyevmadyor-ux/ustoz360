import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { listNotifications, markRead } from "@/server/notify";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => listNotifications((await requireUser()).id));
/** Body: { ids?: string[] }. ids berilmasa hammasi o'qildi deb belgilanadi. */
export const POST = (req: Request) => handle(async () => {
  const u = await requireUser();
  const { ids } = z.object({ ids: z.array(z.string().max(60)).max(100).optional() }).parse(await req.json().catch(() => ({})));
  return markRead(u.id, ids);
});
