/** Tariflar (server ham, brauzer ham ishlatadi). Narxlar sinov uchun belgilangan, yakuniy emas. */
export const PLAN_KEYS = ["FREE", "PRO", "PREMIUM", "MARKAZ"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type Plan = {
  key: PlanKey; name: string;
  /** So'm/oy. null: kelishuv asosida (sotib olinmaydi, admin beradi). */
  priceUzs: number | null;
  /** AI kunlik limitiga ko'paytirgich (asosiy limit sozlamalardan: FREE = 1x). */
  aiFactor: number;
  features: string[];
};

export const PLANS: Record<PlanKey, Plan> = {
  FREE: { key: "FREE", name: "FREE", priceUzs: 0, aiFactor: 1, features: ["Testlar va diagnostika", "Cheklangan AI so'rovlar", "Asosiy kabinet"] },
  PRO: { key: "PRO", name: "PRO", priceUzs: 39_000, aiFactor: 2, features: ["Free imkoniyatlari", "AI limiti 2 barobar", "Dars ishlanmalarini saqlash"] },
  PREMIUM: { key: "PREMIUM", name: "PREMIUM", priceUzs: 69_000, aiFactor: 3, features: ["Pro imkoniyatlari", "AI limiti 3 barobar", "BILIMXONA: kengaytirilgan kutubxona"] },
  MARKAZ: { key: "MARKAZ", name: "MENTOR / MARKAZ", priceUzs: null, aiFactor: 5, features: ["Guruh boshqaruvi", "AI limiti 5 barobar", "Kelishuv asosida"] },
};

export const isPlanKey = (v: unknown): v is PlanKey => typeof v === "string" && (PLAN_KEYS as readonly string[]).includes(v);

/** Pul miqdori: "189 000 so'm" (probel bilan, brauzer lokaliga bog'liq emas). */
export const fmtUzs = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export const MODULE_KEYS = ["ai", "darsyor", "toifa", "market", "sinf", "bilimxona", "bepul"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
