import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ITEMS, ADMIN_NAV, adminItemFor, manageLinkFor, MANAGE_LINKS } from "./admin-nav";

const pageFile = (href: string) => join(process.cwd(), "src", "app", "(app)", ...href.split("/").filter(Boolean), "page.tsx");

describe("admin menyusi", () => {
  it("menyudagi har bir havola uchun sahifa mavjud", () => {
    for (const i of ADMIN_ITEMS) expect(existsSync(pageFile(i.href)), i.href).toBe(true);
  });
  it("havolalar takrorlanmaydi va hammasi /admin ichida", () => {
    const hrefs = ADMIN_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h === "/admin" || h.startsWith("/admin/"))).toBe(true);
  });
  it("faol band eng aniq mos keladigani, noma'lum yo'l uchun topilmaydi", () => {
    expect(adminItemFor("/admin")?.label).toBe("Dashboard");
    expect(adminItemFor("/admin/imtihonlar/abc123")?.label).toBe("Imtihonlar");
    expect(adminItemFor("/admin/statistika")?.label).toBe("Statistika");
    expect(adminItemFor("/dashboard")).toBeUndefined();
  });
  it("guruhlar bo'sh emas", () => { for (const g of ADMIN_NAV) expect(g.items.length).toBeGreaterThan(0); });
});

describe("ustoz bo'limida admin paneli", () => {
  it("har bir yo'nalish uchun boshqaruv havolasi mavjud admin sahifasiga olib boradi", () => {
    for (const m of MANAGE_LINKS) expect(existsSync(pageFile(m.href)), m.href).toBe(true);
  });
  it("yo'lga mos boshqaruv havolasi topiladi", () => {
    expect(manageLinkFor("/market/muallif")?.href).toBe("/admin/kurslar");
    expect(manageLinkFor("/toifa/hujjatlar")?.href).toBe("/admin/rasmiy");
    expect(manageLinkFor("/ustoz-ai/testlar")?.href).toBe("/admin/savollar");
    expect(manageLinkFor("/dashboard")?.href).toBe("/admin/elonlar");
    expect(manageLinkFor("/kirish")).toBeUndefined();
  });
});
