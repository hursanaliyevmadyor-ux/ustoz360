import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { CONSENT_TEXT, consentState, hubMode, setConsent } from "@/server/hub/knowledge";
import { consentInput } from "@/server/hub/knowledgevalid";
export const dynamic = "force-dynamic";

/**
 * Umumiy bilimni yaxshilash uchun ixtiyoriy rozilik (standart: o'chiq). Tushuntirish matni bilan.
 * `active`: administrator Bilim markazini yoqqan (aks holda rozilik hech narsaga ta'sir qilmaydi va interfeysda ko'rsatilmaydi).
 */
const view = async (userId: string) => ({ ...(await consentState(userId)), active: (await hubMode()) !== "off", text: CONSENT_TEXT });
export const GET = () => handle(async () => view((await requireUser()).id));

export const PUT = (req: Request) => handle(async () => {
  const u = await requireUser();
  await setConsent(u.id, consentInput.parse(await req.json()).enabled);
  return view(u.id);
});
