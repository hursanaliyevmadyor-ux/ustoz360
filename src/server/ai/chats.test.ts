import { beforeEach, describe, expect, it, vi } from "vitest";

const { aiChat } = vi.hoisted(() => ({ aiChat: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() } }));
vi.mock("../db", () => ({ db: { aiChat } }));

import { deleteChat, saveExchange } from "./chats";

beforeEach(() => { Object.values(aiChat).forEach((f) => f.mockReset()); });

describe("saveExchange", () => {
  it("yangi chat ochadi va id qaytaradi", async () => {
    aiChat.create.mockResolvedValue({ id: "c1" }); aiChat.findMany.mockResolvedValue([]);
    expect(await saveExchange("u1", undefined, "free", "  Salom   dunyo ", "javob")).toBe("c1");
    expect(aiChat.create.mock.calls[0][0].data.title).toBe("Salom dunyo");
  });

  it("boshqa foydalanuvchining chatiga yozib bo'lmaydi", async () => {
    aiChat.findFirst.mockResolvedValue(null);
    await expect(saveExchange("u1", "boshqaniki", "free", "q", "a")).rejects.toMatchObject({ status: 404 });
    expect(aiChat.update).not.toHaveBeenCalled();
  });

  it("baza xato bersa javob yo'qolmaydi (null qaytaradi)", async () => {
    aiChat.create.mockRejectedValue(new Error("relation AiChat does not exist"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveExchange("u1", undefined, "free", "q", "a")).toBeNull();
  });
});

describe("deleteChat", () => {
  it("faqat o'zining chatini o'chiradi", async () => {
    aiChat.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteChat("u1", "x")).rejects.toMatchObject({ status: 404 });
    expect(aiChat.deleteMany).toHaveBeenCalledWith({ where: { id: "x", userId: "u1" } });
  });
});
