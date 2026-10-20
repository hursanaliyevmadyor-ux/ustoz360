import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { listCollections } from "@/server/import/collections";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => listCollections(await requireUser()));
