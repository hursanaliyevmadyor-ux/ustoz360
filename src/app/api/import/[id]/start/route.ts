import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { startImport } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const body = z.object({ title: z.string().trim().max(120).optional() });
export const POST = (req: Request, { params }: Ctx) => handle(async () => startImport(await requireUser(), (await params).id, body.parse(await req.json().catch(() => ({}))).title));
