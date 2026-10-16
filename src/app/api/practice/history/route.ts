import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { practiceHistory } from "@/server/practice";
export const dynamic = "force-dynamic";

/** Filtrlar: ?kind=timed&subject=Fan nomi&days=30 */
export const GET = (req: Request) => handle(async () => {
  const user = await requireUser();
  const p = new URL(req.url).searchParams;
  const days = Number(p.get("days"));
  return { items: await practiceHistory(user.id, { kind: p.get("kind") || undefined, subject: p.get("subject") || undefined, days: days > 0 && days <= 365 ? days : undefined }) };
});
