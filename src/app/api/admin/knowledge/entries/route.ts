import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { createEntry, listEntries } from "@/server/hub/knowledge";
import { entryInput } from "@/server/hub/knowledgevalid";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => {
  await requireAdmin();
  const u = new URL(req.url);
  return { items: await listEntries({ status: u.searchParams.get("status") ?? "ALL", q: u.searchParams.get("q") ?? undefined }) };
});

/** Admin qo'lda tasdiqlangan bilim kiritadi (o'zi tekshirgan, manbali). */
export const POST = (req: Request) => handle(async () => {
  const a = await requireAdmin();
  return createEntry(a.id, entryInput.parse(await req.json()));
});
