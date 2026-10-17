import { PLAN_KEYS, PLANS, type PlanKey } from "../lib/plans";

export type SubRow = { planKey: string; status: string; startsAt: Date; endsAt: Date | null };

const RANK: Record<string, number> = Object.fromEntries(PLAN_KEYS.map((k, i) => [k, i]));

/** Hozir amaldagi eng yuqori tarif: faol, boshlangan va muddati o'tmagan obuna. Hech biri bo'lmasa FREE. */
export function activePlan(subs: SubRow[], now = new Date()): PlanKey {
  let best: PlanKey = "FREE";
  for (const s of subs) {
    if (s.status !== "ACTIVE" || s.startsAt > now || (s.endsAt && s.endsAt <= now)) continue;
    if (s.planKey in RANK && RANK[s.planKey] > RANK[best]) best = s.planKey as PlanKey;
  }
  return best;
}

/** Foydalanuvchining kunlik AI limiti: asosiy limit * tarif ko'paytirgichi. */
export const aiLimitFor = (plan: PlanKey, base: number) => Math.max(1, Math.round(base * PLANS[plan].aiFactor));

/** Obuna tugash sanasi: amaldagi obuna tugamagan bo'lsa, undan keyin 30 kun; bo'lmasa bugundan 30 kun. */
export function nextSubscriptionEnd(currentEnd: Date | null, now = new Date(), days = 30) {
  const from = currentEnd && currentEnd > now ? currentEnd : now;
  return new Date(from.getTime() + days * 86_400_000);
}
