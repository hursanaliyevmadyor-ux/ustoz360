import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { removeFile, setFileOptions } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; fid: string }> };

/** role: faylning vazifasi; pages: o'qiladigan sahifalar («3-14, 655-657», bo'sh = butun fayl; faqat PDF). */
const body = z.object({ role: z.enum(["AUTO", "QUESTIONS", "ANSWERS"]).optional(), pages: z.string().max(200).nullable().optional() });
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return setFileOptions(await requireUser(), p.id, p.fid, body.parse(await req.json())); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { const p = await params; return removeFile(await requireUser(), p.id, p.fid); });
