import { redirect } from "next/navigation";

/** Eski takrorlash sahifasi: xatolarni takrorlash endi "Xatolar testi" rejimida (Testlar bo'limida), shuning uchun u yerga yo'naltiriladi. */
export default function Page() {
  redirect("/ustoz-ai/testlar/sozlash?mode=errors");
}
