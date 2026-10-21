import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, { bytes: Buffer; mime: string }>());
vi.mock("../storage", () => ({
  storage: () => ({
    configured: () => true,
    put: async (key: string, bytes: Buffer, mime: string) => { store.set(key, { bytes: Buffer.from(bytes), mime }); },
    get: async (key: string) => { const v = store.get(key); if (!v) throw new Error("yo'q"); return v.bytes; },
    remove: async (key: string) => { store.delete(key); },
  }),
}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../auth", () => ({ ApiError: class ApiError extends Error {} }));

import { bindDocImages, hasImgMark, sniffImage } from "./figures";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 9]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 9]);

describe("rasm turini bayt belgilaridan aniqlash", () => {
  it("PNG, JPEG, GIF, WebP taniladi; boshqasi va qisqa bo'lsa null", () => {
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(JPG)).toBe("image/jpeg");
    expect(sniffImage(Buffer.from("GIF89a......"))).toBe("image/gif");
    expect(sniffImage(Buffer.from("RIFF....WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(Buffer.from("EMF-bytes-not-supported"))).toBeNull();
    expect(sniffImage(Buffer.from([1, 2, 3]))).toBeNull();
  });
});

describe("DOCX rasmlari savolga biriktiriladi", () => {
  const o = { owner: "u1", sessionId: "s1", qid: "q1" };

  it("belgilar o'z joyida [[RASM:n]] ga aylanadi, rasm baytlari saqlanadi va tayyor deb belgilanadi", async () => {
    store.clear();
    const images = new Map([[2, { bytes: PNG }], [3, { bytes: JPG }]]);
    const r = await bindDocImages("Shakldagi [[IMG:2]] burchakni toping.", [{ label: "A", text: "30" }, { label: "B", text: "[[IMG:3]]" }], { ...o, images });
    expect(r.text).toBe("Shakldagi [[RASM:1]] burchakni toping.");
    expect(r.options.map((x) => x.text)).toEqual(["30", "[[RASM:2]]"]);
    expect(r.up).toEqual([1, 2]);
    expect(r.missing).toBe(0);
    expect(r.figures).toEqual([
      { n: 1, page: null, box: null, kind: "figure", src: "u1/s1-q1-1" },
      { n: 2, page: null, box: null, kind: "figure", src: "u1/s1-q1-2" },
    ]);
    expect(store.get("figures/u1/s1-q1-1.png")!.mime).toBe("image/png");
    expect(store.get("figures/u1/s1-q1-2.png")!.mime).toBe("image/jpeg");
  });

  it("bir rasm ikki joyda kelsa bitta joy; o'qib bo'lmaydigan rasm «unreadable» va missing bilan qaytadi", async () => {
    store.clear();
    const images = new Map<number, { bytes: Buffer | null }>([[1, { bytes: PNG }], [4, { bytes: Buffer.from("EMF-bytes-not-supported") }], [5, { bytes: null }]]);
    const r = await bindDocImages("[[IMG:1]] va yana [[IMG:1]], chizma [[IMG:4]] hamda [[IMG:5]], yo'q [[IMG:9]]", [], { ...o, images });
    expect(r.text).toBe("[[RASM:1]] va yana [[RASM:1]], chizma [[RASM:2]] hamda [[RASM:3]], yo'q [[RASM:4]]");
    expect(r.up).toEqual([1]);
    expect(r.missing).toBe(3);
    expect(r.figures.map((f) => f.kind)).toEqual(["figure", "unreadable", "unreadable", "unreadable"]);
  });

  it("belgi borligini aniqlaydi", () => {
    expect(hasImgMark("matn [[IMG:12]]")).toBe(true);
    expect(hasImgMark("matn [[RASM:1]]")).toBe(false);
  });
});
