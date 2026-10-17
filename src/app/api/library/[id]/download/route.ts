import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { downloadUrl } from "@/server/library";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Qisqa muddatli (5 daqiqa) imzolangan havolani qaytaradi. */
export const GET = (_r: Request, { params }: Ctx) => handle(async () => downloadUrl(await requireUser(), (await params).id));
