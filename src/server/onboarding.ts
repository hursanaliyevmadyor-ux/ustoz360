import { db } from "./db";

/** Foydalanuvchi ism-familiya va yashash joyini to'ldirganmi. */
export async function isOnboarded(userId: string): Promise<boolean> {
  const p = await db.profile.findUnique({ where: { userId }, select: { onboardedAt: true } });
  return !!p?.onboardedAt;
}

/** Kirishdan keyin qayerga yo'naltirish: to'ldirmagan bo'lsa ro'yxatdan o'tish sahifasiga. Xato bo'lsa kirishni to'smaydi. */
export async function landingPath(userId: string): Promise<"/royxat" | "/dashboard"> {
  try { return (await isOnboarded(userId)) ? "/dashboard" : "/royxat"; } catch (e) { console.error("onboarding tekshiruvi", (e as Error).message); return "/dashboard"; }
}
