import { beforeEach, describe, expect, it, vi } from "vitest";

const { profile } = vi.hoisted(() => ({ profile: { findUnique: vi.fn() } }));
vi.mock("./db", () => ({ db: { profile } }));

import { isOnboarded, landingPath } from "./onboarding";

beforeEach(() => { profile.findUnique.mockReset(); });

describe("onboarding", () => {
  it("to'ldirmagan foydalanuvchi /royxat ga yo'naltiriladi", async () => {
    profile.findUnique.mockResolvedValue({ onboardedAt: null });
    expect(await isOnboarded("u1")).toBe(false);
    expect(await landingPath("u1")).toBe("/royxat");
  });
  it("profili yo'q foydalanuvchi ham /royxat ga boradi", async () => {
    profile.findUnique.mockResolvedValue(null);
    expect(await landingPath("u1")).toBe("/royxat");
  });
  it("to'ldirgan foydalanuvchi dashboardga boradi", async () => {
    profile.findUnique.mockResolvedValue({ onboardedAt: new Date() });
    expect(await landingPath("u1")).toBe("/dashboard");
  });
  it("baza xato bersa kirishni to'smaydi", async () => {
    profile.findUnique.mockRejectedValue(new Error("column does not exist"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await landingPath("u1")).toBe("/dashboard");
  });
});
