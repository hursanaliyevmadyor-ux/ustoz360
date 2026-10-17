import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { addPlanItem, generatePlan } from "@/server/toifa";
import { planItemInput } from "@/server/toifavalid";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** POST {} → diagnostika va test natijalariga ko'ra rejani qoidalar bilan qayta tuzadi. POST {date,title} → qo'lda band qo'shadi. */
export const POST = (req: Request) => handle(async () => {
  const u = await requireUser();
  const b = await req.json().catch(() => ({}));
  if (b && typeof b === "object" && "title" in b) return addPlanItem(u.id, planItemInput.parse(b));
  return generatePlan(u.id);
});
