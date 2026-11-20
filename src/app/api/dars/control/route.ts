import { handle } from "@/server/http";
import { closeRoom, muteAll, setSpeaking } from "@/server/voice";
import { controlInput } from "@/server/voicelogic";
export const dynamic = "force-dynamic";

/** Ustoz boshqaruvi (gapirishga ruxsat, hammani o'chirish, xonani yopish): faqat boshqaruv imzosi to'g'ri bo'lsa. */
export const POST = (req: Request) => handle(async () => {
  const b = controlInput.parse(await req.json());
  if (b.action === "speak") return setSpeaking(b);
  if (b.action === "mute-all") return muteAll(b);
  return closeRoom(b);
});
