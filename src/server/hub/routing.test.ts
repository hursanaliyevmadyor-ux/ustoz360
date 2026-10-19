import { describe, expect, it } from "vitest";
import { Breaker, errorRate, orderProviders, verifierOf } from "./routing";

const P = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (l: { id: string }[]) => l.map((x) => x.id);

describe("provayder tartibi", () => {
  it("rol berilmasa tabiiy tartib saqlanadi (hozirgi xatti-harakat o'zgarmaydi)", () => {
    expect(ids(orderProviders(P("free1", "free2", "free3"), {}))).toEqual(["free1", "free2", "free3"]);
  });
  it("asosiy birinchi, o'chirilgan va tekshiruvchi oddiy zanjirdan chiqadi", () => {
    const roles = { free2: "primary", free3: "disabled", free4: "verifier" } as const;
    expect(ids(orderProviders(P("free1", "free2", "free3", "free4", "free5"), roles))).toEqual(["free2", "free1", "free5"]);
  });
  it("uzilgan xizmat oxiriga suriladi, lekin olib tashlanmaydi", () => {
    const open = (id: string) => id === "free1";
    expect(ids(orderProviders(P("free1", "free2", "free3"), {}, open))).toEqual(["free2", "free3", "free1"]);
    expect(ids(orderProviders(P("free1"), {}, () => true))).toEqual(["free1"]);
    // uzilgan asosiy ham oxirga ketadi
    expect(ids(orderProviders(P("free1", "free2"), { free1: "primary" }, (id) => id === "free1"))).toEqual(["free2", "free1"]);
  });
  it("tekshiruvchi topiladi", () => {
    expect(verifierOf(P("free1", "free2"), { free2: "verifier" })?.id).toBe("free2");
    expect(verifierOf(P("free1"), {})).toBeUndefined();
  });
});

describe("uzilish himoyasi (breaker)", () => {
  it("3 ta ketma-ket xatodan keyin uziladi, vaqt o'tgach yana ochiladi", () => {
    const b = new Breaker(3, 60_000);
    b.fail("a", 0); b.fail("a", 1); expect(b.isOpen("a", 2)).toBe(false);
    b.fail("a", 2); expect(b.isOpen("a", 3)).toBe(true);
    expect(b.retryIn("a", 3)).toBe(60);
    expect(b.isOpen("a", 60_003)).toBe(false);
  });
  it("muvaffaqiyat holatni tozalaydi; boshqa xizmatga ta'sir qilmaydi", () => {
    const b = new Breaker(2, 1000);
    b.fail("a", 0); b.fail("b", 0); b.ok("a"); b.fail("a", 1);
    expect(b.isOpen("a", 2)).toBe(false);
    b.fail("b", 1); expect(b.isOpen("b", 2)).toBe(true); expect(b.isOpen("a", 2)).toBe(false);
  });
  it("qayta xato bersa uzilish muddati ikki baravar uzayadi (chegaragacha)", () => {
    const b = new Breaker(1, 1000, 3000);
    b.fail("a", 0); expect(b.retryIn("a", 0)).toBe(1);
    b.fail("a", 1500); expect(b.retryIn("a", 1500)).toBe(2);
    b.fail("a", 5000); expect(b.retryIn("a", 5000)).toBe(3);
    b.fail("a", 9000); expect(b.retryIn("a", 9000)).toBe(3);
  });
});

describe("sog'liq ko'rsatkichi", () => {
  it("xato ulushi foizda", () => { expect(errorRate({ calls: 0, errors: 0 })).toBe(0); expect(errorRate({ calls: 8, errors: 2 })).toBe(25); });
});
