import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { startPractice } from "@/server/practice";
import { startInput } from "@/server/practicelogic";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  return startPractice(user.id, startInput.parse(await req.json()));
});
