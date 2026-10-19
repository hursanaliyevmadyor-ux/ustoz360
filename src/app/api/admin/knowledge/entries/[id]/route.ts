import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { applyEntryAction, updateEntry } from "@/server/hub/knowledge";
import type { EntryAction } from "@/server/hub/knowledgelogic";
import { entryActionInput, entryUpdate } from "@/server/hub/knowledgevalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Yozuvni tahrirlash (savol, javob, manba, muddat). Holatni o'zgartirmaydi: qayta tasdiqlash uchun «restore» amali. */
export const PUT = (req: Request, { params }: Ctx) => handle(async () => {
  const a = await requireAdmin();
  return updateEntry(a.id, (await params).id, entryUpdate.parse(await req.json()));
});

/** Arxivlash, xato deb belgilash, qayta tekshirishga yuborish, qayta tasdiqlash (har biri audit jurnali bilan). */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const a = await requireAdmin();
  const b = entryActionInput.parse(await req.json());
  return applyEntryAction(a.id, (await params).id, b.action as EntryAction, { note: b.note, expiresOn: b.expiresOn });
});
