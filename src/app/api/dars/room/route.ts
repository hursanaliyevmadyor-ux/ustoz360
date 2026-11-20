import { requireUser } from "@/server/auth";
import { ApiError } from "@/server/auth";
import { handle } from "@/server/http";
import { voiceConfig } from "@/server/voice";
import { roomInput, signRoom } from "@/server/voicelogic";
import { newRoomCode } from "@/lib/dars";
export const dynamic = "force-dynamic";

/** Ovozli xona yaratish: faqat tizimga kirgan ustoz. Kod va imzolar serverda hosil bo'ladi. */
export const POST = (req: Request) => handle(async () => {
  await requireUser();
  const c = voiceConfig();
  if (!c) throw new ApiError(503, "Ovozli xona hozircha sozlanmagan.", "voice_off");
  const { mode } = roomInput.parse(await req.json());
  const code = newRoomCode();
  return { code, mode, ...signRoom(c.authSecret, code, mode) };
});
