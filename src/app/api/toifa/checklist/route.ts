import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { addChecklist, seedChecklist } from "@/server/toifa";
import { checklistInput } from "@/server/toifavalid";
export const dynamic = "force-dynamic";

/** POST {label} → band qo'shadi. POST {seed:true} → umumiy tavsiya bandlarini qo'shadi (faqat cheklist bo'sh bo'lsa). */
export const POST = (req: Request) => handle(async () => {
  const u = await requireUser();
  const b = await req.json().catch(() => ({}));
  if (b && typeof b === "object" && (b as { seed?: boolean }).seed) return seedChecklist(u.id);
  return addChecklist(u.id, checklistInput.parse(b));
});
