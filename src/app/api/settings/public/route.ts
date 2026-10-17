import { handle } from "@/server/http";
import { publicSettings } from "@/server/settings";
export const dynamic = "force-dynamic";

/** Hamma ko'radigan sozlamalar (modullar yoqilganmi, sayt nomi). Maxfiy ma'lumot yo'q. */
export const GET = () => handle(() => publicSettings());
