import { PLANS, type PlanKey } from "../lib/plans";
import { db } from "./db";
import { activePlan, aiLimitFor } from "./entitlementlogic";
import { getSetting } from "./settings";

/**
 * Huquqlar xizmati: foydalanuvchi qaysi tarifda va nimaga ruxsati bor. Barcha modullar shu yerdan so'raydi
 * (alohida joyda "PRO" tekshiruvi yozilmaydi).
 */
export type Entitlements = { plan: PlanKey; planName: string; aiDaily: number; freeAiDaily: number };

export const DEFAULT_AI_DAILY = () => Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 30);
export const DEFAULT_FREE_AI_DAILY = () => Math.max(1, Number(process.env.AI_FREE_DAILY_LIMIT) || 50);

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const [subs, ai] = await Promise.all([
    db.subscription.findMany({ where: { userId, status: "ACTIVE" }, select: { planKey: true, status: true, startsAt: true, endsAt: true } }),
    getSetting("ai"),
  ]);
  const plan = activePlan(subs);
  return {
    plan, planName: PLANS[plan].name,
    aiDaily: aiLimitFor(plan, ai.dailyLimit ?? DEFAULT_AI_DAILY()),
    freeAiDaily: aiLimitFor(plan, ai.freeDailyLimit ?? DEFAULT_FREE_AI_DAILY()),
  };
}
