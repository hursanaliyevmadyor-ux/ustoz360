import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { createSession, listSessions } from "@/server/import/service";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => listSessions(await requireUser()));

const body = z.object({ title: z.string().trim().max(120).optional() });
export const POST = (req: Request) => handle(async () => createSession(await requireUser(), body.parse(await req.json().catch(() => ({}))).title));
