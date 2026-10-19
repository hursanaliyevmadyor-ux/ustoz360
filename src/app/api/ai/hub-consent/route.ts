import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { CONSENT_TEXT, consentState, hubMode, setConsent } from "@/server/hub/knowledge";
import { consentInput } from "@/server/hub/knowledgevalid";
export const dynamic = "force-dynamic";

/**
 * ESKIRGAN: AI sahifasida rozilik so'rovi olib tashlangan, aniq javob olingan savol endi avtomatik nomzod bo'ladi (rozilik hisobga olinmaydi).
 * Bu manzil faqat eski mijozlar xato olmasligi uchun qoldirilgan.
 */
const view = async (userId: string) => ({ ...(await consentState(userId)), active: (await hubMode()) !== "off", text: CONSENT_TEXT });
export const GET = () => handle(async () => view((await requireUser()).id));

export const PUT = (req: Request) => handle(async () => {
  const u = await requireUser();
  await setConsent(u.id, consentInput.parse(await req.json()).enabled);
  return view(u.id);
});
