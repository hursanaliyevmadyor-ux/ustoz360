import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ gen: vi.fn() }));
vi.mock("./structured", () => ({ generateStructured: h.gen }));

import { generateLesson, generateTasks } from "./generate";

beforeEach(() => { vi.clearAllMocks(); });

describe("DARSYOR: AI Bilim markazidan bilim qidirish fan va mavzu bo'yicha", () => {
  it("dars ishlanmasi: qidiruv matni «fan mavzu» (uzun ko'rsatma emas), shuning uchun mos tasdiqlangan bilim topiladi", async () => {
    h.gen.mockResolvedValue({ data: { sections: [{ title: "Maqsad va kutiladigan natijalar", content: "x" }] }, model: "m" });
    await generateLesson("u1", { subject: "Matematika", grade: 5, topic: "Oddiy kasrlar", duration: 45, goal: "" });
    expect(h.gen.mock.calls[0][0]).toMatchObject({ feature: "lesson", knowledge: "Matematika Oddiy kasrlar" });
    expect(h.gen.mock.calls[0][0].prompt).toContain("Mavzu: Oddiy kasrlar");
  });

  it("test topshiriqlari: xuddi shunday fan va mavzu bo'yicha", async () => {
    h.gen.mockResolvedValue({ data: { items: [] }, model: "m" });
    await generateTasks("u1", { subject: "Fizika", grade: "7", topic: "Bosim", level: "easy", count: 3, types: ["single"] }).catch(() => undefined);
    expect(h.gen.mock.calls[0][0]).toMatchObject({ feature: "taskset", knowledge: "Fizika Bosim" });
  });
});
