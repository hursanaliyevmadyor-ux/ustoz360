import type { z } from "zod";
import { extractJson } from "../practicelogic";

/** AI javobini Zod sxemasi bilan tekshiradi. Noto'g'ri bo'lsa qayta so'rash uchun qisqa xato matni qaytaradi. */
export function parseStructured<T>(text: string, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false; error: string } {
  const raw = extractJson(text);
  if (raw == null) return { ok: false, error: "javobda JSON obyekt topilmadi" };
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const i = r.error.issues[0];
  return { ok: false, error: `${i?.path.join(".") || "ildiz"}: ${i?.message ?? "noto'g'ri qiymat"}` };
}
