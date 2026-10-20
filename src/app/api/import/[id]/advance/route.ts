import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { advanceImport } from "@/server/import/pipeline";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** Qayta ishlashning bitta ish birligini bajaradi va holatni qaytaradi. Mijoz `finished` bo'lguncha (yoki `wait` soniya kutib) qayta chaqiradi. */
export const POST = (_r: Request, { params }: Ctx) => handle(async () => advanceImport((await requireUser()).id, (await params).id));
