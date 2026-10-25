import { describe, expect, it } from "vitest";
import { healthHint } from "./ai-hints";

describe("ulanishni sinash: xato izohi", () => {
  it("404 model nomi, 429 limit, 401/403 kalit, 5xx band, kechikish", () => {
    expect(healthHint("404")).toMatch(/model nomi/);
    expect(healthHint("429")).toMatch(/limit|kvota/);
    expect(healthHint("401")).toMatch(/kalit/);
    expect(healthHint("403")).toMatch(/kalit/);
    expect(healthHint("503")).toMatch(/band/);
    expect(healthHint("TimeoutError")).toMatch(/kechikdi/);
  });
  it("noma'lum yoki bo'sh kod uchun izoh yo'q", () => {
    expect(healthHint(undefined)).toBe("");
    expect(healthHint("")).toBe("");
    expect(healthHint("TypeError")).toBe("");
  });
});
