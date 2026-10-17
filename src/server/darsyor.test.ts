import { describe, expect, it } from "vitest";
import { docInput, seededShuffle, taskProblems, type TaskItem } from "./docsvalid";
import { aiTaskReply, normalizeAiTasks } from "./ai/tasks";

const task = (p: Partial<TaskItem> = {}): TaskItem => ({ type: "single", text: "Savol?", options: ["a", "b", "c"], correct: [1], pairs: [], answer: "", explanation: "", approved: false, source: "manual", ...p });

describe("DARSYOR hujjat tekshiruvi", () => {
  const plan = { kind: "lesson_plan", title: "Kasrlar", status: "SAVED", data: { params: { subject: "Matematika", grade: "3", topic: "Kasrlar", duration: 45 }, sections: { "Maqsad": "matn" } } };
  it("to'g'ri dars ishlanmasi o'tadi, noto'g'ri tuzilma rad etiladi", () => {
    expect(docInput.safeParse(plan).success).toBe(true);
    expect(docInput.safeParse({ ...plan, data: { params: {}, sections: {} } }).success).toBe(false);
    expect(docInput.safeParse({ ...plan, title: "" }).success).toBe(false);
    expect(docInput.safeParse({ ...plan, kind: "boshqa" }).success).toBe(false);
  });
  it("juda katta hujjat rad etiladi", () => {
    const big = { ...plan, data: { ...plan.data, sections: { "Maqsad": "x".repeat(8000), "B": "x".repeat(8000), "C": "x".repeat(8000), "D": "x".repeat(8000), "E": "x".repeat(8000), "F": "x".repeat(8000), "G": "x".repeat(8000), "H": "x".repeat(8000), "I": "x".repeat(8000), "J": "x".repeat(8000), "K": "x".repeat(8000), "L": "x".repeat(8000), "M": "x".repeat(8000), "N": "x".repeat(8000), "O": "x".repeat(8000), "P": "x".repeat(8000), "Q": "x".repeat(8000), "R": "x".repeat(8000), "S": "x".repeat(8000), "T": "x".repeat(8000), "U": "x".repeat(8000), "V": "x".repeat(8000), "W": "x".repeat(8000), "X": "x".repeat(8000), "Y": "x".repeat(8000) } } };
    expect(docInput.safeParse(big).success).toBe(false);
  });
  it("ko'rgazma: Venn 2-3 doira, noma'lum shablon rad etiladi", () => {
    const ok = { kind: "visual", title: "V", status: "DRAFT", data: { template: "venn", labels: ["A", "B"], items: [["x"], []], shared: [] } };
    expect(docInput.safeParse(ok).success).toBe(true);
    expect(docInput.safeParse({ ...ok, data: { template: "venn", labels: ["A"], items: [[]], shared: [] } }).success).toBe(false);
    expect(docInput.safeParse({ ...ok, data: { template: "boshqa" } }).success).toBe(false);
  });
  it("kuzatuv belgilari faqat + ± -", () => {
    const base = { kind: "observation", title: "K", status: "SAVED", data: { group: "3-A", indicators: ["faol"], columns: ["1"], marks: { "0:0": "+" }, notes: "" } };
    expect(docInput.safeParse(base).success).toBe(true);
    expect(docInput.safeParse({ ...base, data: { ...base.data, marks: { "0:0": "5" } } }).success).toBe(false);
  });
});

describe("topshiriq sifati", () => {
  it("to'g'ri bir javobli savolda muammo yo'q", () => expect(taskProblems(task())).toEqual([]));
  it("bir javobli savolda ikkita to'g'ri javob yoki bo'sh variant xato", () => {
    expect(taskProblems(task({ correct: [0, 1] })).join()).toMatch(/aynan bitta/);
    expect(taskProblems(task({ options: ["a", "", "c"], correct: [1] })).join()).toMatch(/bo'sh/);
    expect(taskProblems(task({ options: ["a", "A", "c"], correct: [0] })).join()).toMatch(/farq/);
  });
  it("ko'p javobli savolda kamida 2 ta to'g'ri javob kerak", () => expect(taskProblems(task({ type: "multi", correct: [0] })).length).toBeGreaterThan(0));
  it("moslashtirish, ketma-ketlik va ochiq savol talablari", () => {
    expect(taskProblems(task({ type: "match", options: [], correct: [], pairs: [{ l: "a", r: "b" }] })).length).toBe(1);
    expect(taskProblems(task({ type: "match", options: [], correct: [], pairs: [{ l: "a", r: "b" }, { l: "c", r: "d" }] }))).toEqual([]);
    expect(taskProblems(task({ type: "order", options: ["1", "2"], correct: [] })).length).toBe(1);
    expect(taskProblems(task({ type: "open", options: [], correct: [], answer: "" })).length).toBe(1);
    expect(taskProblems(task({ type: "open", options: [], correct: [], answer: "mezon" }))).toEqual([]);
  });
});

describe("AI topshiriqlarini tozalash", () => {
  it("AI qoralamalari doim tasdiqlanmagan, noto'g'ri turlar tashlanadi", () => {
    const reply = aiTaskReply.parse({ items: [
      { type: "single", text: "A?", options: ["1", "2", "3"], correct: [0], answer: "", explanation: "sabab" },
      { type: "matching", text: "Moslang", pairs: [{ l: "a", r: "b" }, { l: "c", r: "d" }] },
      { type: "essay", text: "Insho" },
      { type: "single", text: "" },
    ] });
    const r = normalizeAiTasks(reply, ["single", "match"], 10);
    expect(r.items.map((i) => i.type)).toEqual(["single", "match", "single"].slice(0, r.items.length));
    expect(r.items.every((i) => i.approved === false && i.source === "ai")).toBe(true);
    expect(r.items.find((i) => i.type === "single" && i.text === "A?")?.correct).toEqual([0]);
  });
  it("kamchilikli topshiriq sanaladi va soni cheklanadi", () => {
    const reply = aiTaskReply.parse({ items: Array.from({ length: 5 }, (_, i) => ({ type: "single", text: `S${i}`, options: ["x"], correct: [0] })) });
    const r = normalizeAiTasks(reply, ["single"], 3);
    expect(r.items.length).toBe(3);
    expect(r.problems).toBe(3);
  });
  it("buzuq maydonlar sahifani buzmaydi", () => {
    const reply = aiTaskReply.parse({ items: [{ type: 5, text: 12, options: "yo'q", correct: "x", pairs: null }] });
    expect(() => normalizeAiTasks(reply, ["single"], 5)).not.toThrow();
  });
});

describe("aralashtirish", () => {
  it("bir xil kalit bir xil tartib beradi, elementlar yo'qolmaydi", () => {
    const a = ["1", "2", "3", "4", "5", "6"];
    expect(seededShuffle(a, "kalit")).toEqual(seededShuffle(a, "kalit"));
    expect(seededShuffle(a, "kalit").slice().sort()).toEqual(a);
    expect(a).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
