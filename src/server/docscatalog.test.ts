import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG_STATUS, docInput } from "./docsvalid";

const h = vi.hoisted(() => ({ findMany: vi.fn(async () => [] as unknown[]) }));
vi.mock("./db", () => ({ db: { teacherDoc: { findMany: h.findMany } } }));
vi.mock("./auth", () => ({ ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } } }));

beforeEach(() => { h.findMany.mockClear(); });

describe("DARSYOR katalogi", () => {
  it("katalog faqat CATALOG holatidagi hujjatlarni, fan va nom bo'yicha tartiblab qaytaradi", async () => {
    h.findMany.mockResolvedValueOnce([{ id: "a", kind: "visual", title: "T", subject: "Matematika", grade: "3", data: { template: "cards", cards: [] } }]);
    const { listCatalog } = await import("./docs");
    const r = await listCatalog({ kind: "visual" });
    expect(r.docs).toEqual([{ id: "a", kind: "visual", title: "T", subject: "Matematika", grade: "3", data: { template: "cards", cards: [] } }]);
    expect(h.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: CATALOG_STATUS, kind: "visual" }, orderBy: [{ subject: "asc" }, { title: "asc" }] }));
  });
  it("katalog natijasida egasi (userId) ko'rsatilmaydi", async () => {
    h.findMany.mockResolvedValueOnce([{ id: "a", kind: "visual", title: "T", subject: null, grade: null, data: {}, userId: "u-secret" }]);
    const { listCatalog } = await import("./docs");
    expect(JSON.stringify(await listCatalog())).not.toContain("u-secret");
  });
  it("noto'g'ri hujjat turi rad etiladi", async () => {
    const { listCatalog } = await import("./docs");
    await expect(listCatalog({ kind: "boshqa" })).rejects.toMatchObject({ status: 400 });
    expect(h.findMany).not.toHaveBeenCalled();
  });
  it("foydalanuvchining o'z ro'yxatida katalog hujjatlari chiqmaydi", async () => {
    const { listDocs } = await import("./docs");
    await listDocs("u1", { kind: "visual" });
    expect(h.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1", status: { not: CATALOG_STATUS }, kind: "visual" } }));
  });
  it("foydalanuvchi hujjatni o'zi katalogga qo'sha olmaydi (holat faqat DRAFT yoki SAVED)", () => {
    const ok = { kind: "visual", title: "V", status: "DRAFT", data: { template: "handout", blocks: [] } };
    expect(docInput.safeParse(ok).success).toBe(true);
    expect(docInput.safeParse({ ...ok, status: CATALOG_STATUS }).success).toBe(false);
  });
});
