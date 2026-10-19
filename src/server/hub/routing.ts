/**
 * Provayder siyosati (toza mantiq): har bir bepul xizmat uchun rol va vaqtinchalik uzilish himoyasi.
 * Har savol hamma AI ga yuborilmaydi: avval bilim bazasi, keyin tartib bo'yicha bitta mos xizmat, xatoda keyingisi.
 * Bir nechta AI bir xil javob bergani haqiqatni isbotlamaydi, shuning uchun «ovoz berish» yo'q.
 */
export type Role = "primary" | "fallback" | "verifier" | "disabled";
export const ROLES: Role[] = ["primary", "fallback", "verifier", "disabled"];
export const ROLE_LABEL: Record<Role, string> = { primary: "Asosiy", fallback: "Zaxira", verifier: "Tekshiruvchi", disabled: "O'chirilgan" };

/**
 * Tartib: o'chirilgan va tekshiruvchi xizmatlar oddiy zanjirdan chiqadi; asosiylar birinchi, qolganlari tabiiy tartibda;
 * hozir uzilgan (ketma-ket xato bergan) xizmat oxiriga suriladi, lekin butunlay olib tashlanmaydi (hammasi uzilgan bo'lsa ham urinib ko'riladi).
 */
export function orderProviders<T extends { id: string }>(list: T[], roles: Record<string, Role | undefined>, isOpen: (id: string) => boolean = () => false): T[] {
  const usable = list.filter((p) => { const r = roles[p.id]; return r !== "disabled" && r !== "verifier"; });
  const rank = (p: T) => (isOpen(p.id) ? 2 : roles[p.id] === "primary" ? 0 : 1);
  return usable.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
}

/** Tekshiruvchi: oddiy zanjirdan tashqari, ikkinchi tekshiruv uchun ajratilgan xizmat (bo'lsa). */
export const verifierOf = <T extends { id: string }>(list: T[], roles: Record<string, Role | undefined>): T | undefined => list.find((p) => roles[p.id] === "verifier");

/**
 * Uzilish himoyasi (circuit breaker): ketma-ket `threshold` ta xatodan keyin xizmat `baseMs` davomida «uzilgan» hisoblanadi;
 * yana xato bersa muddat ikki baravar uzayadi (eng ko'pi `maxMs`). Muvaffaqiyatli javob holatni tozalaydi. Xotirada saqlanadi (har server nusxasida alohida).
 */
export class Breaker {
  private s = new Map<string, { fails: number; until: number; ms: number }>();
  constructor(private threshold = 3, private baseMs = 60_000, private maxMs = 600_000) {}
  fail(id: string, now = Date.now()) {
    const x = this.s.get(id) ?? { fails: 0, until: 0, ms: this.baseMs };
    x.fails += 1;
    if (x.fails >= this.threshold) { x.until = now + x.ms; x.ms = Math.min(this.maxMs, x.ms * 2); x.fails = this.threshold - 1; }
    this.s.set(id, x);
  }
  ok(id: string) { this.s.delete(id); }
  isOpen(id: string, now = Date.now()) { return (this.s.get(id)?.until ?? 0) > now; }
  /** Admin ko'rinishi uchun: uzilish tugaguncha qolgan soniyalar (0: uzilmagan). */
  retryIn(id: string, now = Date.now()) { return Math.max(0, Math.ceil(((this.s.get(id)?.until ?? 0) - now) / 1000)); }
}

/** Provayder sog'liq ko'rsatkichlari (AiRequest jurnalidan): xato ulushi, o'rtacha kechikish. */
export type ProviderStat = { provider: string; calls: number; errors: number; avgMs: number | null; tokens: number };
export const errorRate = (s: { calls: number; errors: number }) => (s.calls ? Math.round((s.errors / s.calls) * 100) : 0);
