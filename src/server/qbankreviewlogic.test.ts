import { describe, expect, it } from "vitest";
import { VERIFIED, bulkApproveInput, progress, queueOrder, reletterExplanation, reviewAction } from "./qbankreviewlogic";

describe("tekshiruv qarorlari", () => {
  it("to'g'ri shakllarni qabul qiladi", () => {
    expect(reviewAction.safeParse({ type: "approve" }).success).toBe(true);
    expect(reviewAction.safeParse({ type: "reject" }).success).toBe(true);
    expect(reviewAction.safeParse({ type: "unverify" }).success).toBe(true);
    expect(reviewAction.safeParse({ type: "fix", correct: 2, explanation: "To'g'ri javob: C. Matnga ko'ra." }).success).toBe(true);
  });
  it("noto'g'ri shakllarni rad etadi", () => {
    expect(reviewAction.safeParse({ type: "fix", correct: 2 }).success).toBe(false);
    expect(reviewAction.safeParse({ type: "fix", correct: -1, explanation: "yetarlicha uzun izoh" }).success).toBe(false);
    expect(reviewAction.safeParse({ type: "fix", correct: 9, explanation: "yetarlicha uzun izoh" }).success).toBe(false);
    expect(reviewAction.safeParse({ type: "fix", correct: 1, explanation: "qisqa" }).success).toBe(false);
    expect(reviewAction.safeParse({ type: "fix", correct: 1, explanation: "x".repeat(1501) }).success).toBe(false);
    expect(reviewAction.safeParse({ type: "delete" }).success).toBe(false);
    expect(reviewAction.safeParse({}).success).toBe(false);
  });
  it("belgi nomi", () => expect(VERIFIED).toBe("VERIFIED"));
});

describe("navbat tartibi", () => {
  it("avval tekshiruvda, keyin qoralama, keyin tasdiqlangan; ichida id bo'yicha", () => {
    const l = [{ id: "c", status: "APPROVED" }, { id: "b", status: "REVIEW" }, { id: "a", status: "APPROVED" }, { id: "d", status: "DRAFT" }, { id: "a2", status: "REVIEW" }];
    expect([...l].sort(queueOrder).map((x) => x.id)).toEqual(["a2", "b", "d", "a", "c"]);
  });
  it("noma'lum holat oxirida", () => {
    expect([{ id: "x", status: "ZZZ" }, { id: "y", status: "APPROVED" }].sort(queueOrder).map((x) => x.id)).toEqual(["y", "x"]);
  });
});

describe("izohdagi javob harfi", () => {
  it("harfni yangilaydi, qolgan matnga tegmaydi", () => {
    expect(reletterExplanation("To'g'ri javob: B.\nNima uchun: sabab.", 2)).toBe("To'g'ri javob: C.\nNima uchun: sabab.");
    expect(reletterExplanation("To'g'ri javob: A.", 3)).toBe("To'g'ri javob: D.");
  });
  it("harfsiz izohga boshiga qo'shadi", () => {
    expect(reletterExplanation("Chunki matnda shunday.", 0)).toBe("To'g'ri javob: A.\nChunki matnda shunday.");
  });
  it("faqat boshidagi qatorni almashtiradi", () => {
    expect(reletterExplanation("To'g'ri javob: B.\nEslatma: To'g'ri javob: B emas.", 1)).toBe("To'g'ri javob: B.\nEslatma: To'g'ri javob: B emas.");
  });
});

describe("jarayon", () => {
  it("qolgan va foiz", () => {
    expect(progress({ verified: 25, total: 100 })).toEqual({ verified: 25, total: 100, remaining: 75, percent: 25 });
    expect(progress({ verified: 0, total: 0 })).toEqual({ verified: 0, total: 0, remaining: 0, percent: 100 });
    expect(progress({ verified: 9, total: 7 }).remaining).toBe(0);
  });
});

describe("ommaviy tasdiqlash", () => {
  it("ro'yxat yoki «hammasi»: faqat bittasi", () => {
    expect(bulkApproveInput.safeParse({ ids: ["a", "b"] }).success).toBe(true);
    expect(bulkApproveInput.safeParse({ all: true }).success).toBe(true);
    expect(bulkApproveInput.safeParse({ all: true, filter: { status: "REVIEW", verified: "0" } }).success).toBe(true);
  });
  it("noto'g'ri so'rovlarni rad etadi", () => {
    expect(bulkApproveInput.safeParse({}).success).toBe(false);
    expect(bulkApproveInput.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkApproveInput.safeParse({ all: false }).success).toBe(false);
    expect(bulkApproveInput.safeParse({ ids: ["a"], all: true }).success).toBe(false);
    expect(bulkApproveInput.safeParse({ ids: Array.from({ length: 1001 }, (_, i) => String(i)) }).success).toBe(false);
    expect(bulkApproveInput.safeParse({ ids: [""] }).success).toBe(false);
    expect(bulkApproveInput.safeParse({ all: true, filter: { status: 5 } }).success).toBe(false);
  });
});
