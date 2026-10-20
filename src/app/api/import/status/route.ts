import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { importStatus } from "@/server/import/service";
export const dynamic = "force-dynamic";

/** Import imkoniyatlari: saqlash, AI va chegaralar holati («BLOCKED» qismlar halol ko'rsatilishi uchun). */
export const GET = () => handle(async () => importStatus((await requireUser()).id));
