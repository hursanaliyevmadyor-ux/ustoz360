import { describe, expect, it } from "vitest";
import type { Digest } from "./digest";
import { homeScreen } from "./sections/home";

const d = { today: "2026-11-20", tomorrow: "2026-11-21", plan: [], planFuture: 0, dueErrors: 0, resume: null, seminars: [], daysLeft: null, targetExam: null, planName: "FREE", announcements: [] } as unknown as Digest;
const flat = (s: ReturnType<typeof homeScreen>) => (s.kb ?? []).flat() as { text: string; url?: string }[];

describe("bosh sahifa: jonli dars tugmasi", () => {
  it("https manzil bo'lsa, /dars ga olib boradigan havola tugmasi bor", () => {
    const btn = flat(homeScreen("Ali", d, "https://ustoz360.vercel.app")).find((b) => b.text.includes("Jonli dars"));
    expect(btn?.url).toBe("https://ustoz360.vercel.app/dars");
  });
  it("manzil yo'q yoki https emas bo'lsa, tugma qo'yilmaydi (Telegram faqat https qabul qiladi)", () => {
    expect(flat(homeScreen("Ali", d)).some((b) => b.text.includes("Jonli dars"))).toBe(false);
    expect(flat(homeScreen("Ali", d, "http://localhost:3000")).some((b) => b.text.includes("Jonli dars"))).toBe(false);
  });
});
