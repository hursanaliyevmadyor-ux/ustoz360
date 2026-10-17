import { beforeEach, describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import { chunkText, detectKind, extractDocx, extractText, MAX_FILE_BYTES, safeFileName } from "./librarylogic";
import { buildGroundedPrompt, keywordRetriever, tokens } from "./rag";

const enc = (s: string) => new TextEncoder().encode(s);

/** Sinov uchun eng oddiy DOCX: bitta `word/document.xml` yozuvli zip. */
function makeDocx(xml: string): Uint8Array {
  const name = Buffer.from("word/document.xml"); const data = deflateRawSync(Buffer.from(xml));
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = local.length + name.length + data.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + name.length, 12); eocd.writeUInt32LE(cdOffset, 16);
  return new Uint8Array(Buffer.concat([local, name, data, central, name, eocd]));
}

describe("fayl tekshiruvi", () => {
  it("kengaytma va haqiqiy tarkib mos bo'lishi shart", () => {
    expect(detectKind("a.pdf", enc("%PDF-1.7 ...")).ok).toBe(true);
    expect(detectKind("a.pdf", enc("<html>")).ok).toBe(false);
    expect(detectKind("a.docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1])).ok).toBe(true);
    expect(detectKind("a.docx", enc("matn")).ok).toBe(false);
    expect(detectKind("a.txt", enc("Salom, dunyo")).ok).toBe(true);
  });
  it("ruxsat etilmagan turlar, bo'sh va katta fayllar rad etiladi", () => {
    expect(detectKind("a.exe", enc("MZ")).ok).toBe(false);
    expect(detectKind("a.pdf.exe", enc("%PDF-")).ok).toBe(false);
    expect(detectKind("a.txt", new Uint8Array()).ok).toBe(false);
    expect(detectKind("a.txt", new Uint8Array(MAX_FILE_BYTES + 1).fill(65)).ok).toBe(false);
  });
  it("TXT: ikkilik belgi yoki UTF-8 bo'lmagan bayt rad etiladi", () => {
    expect(detectKind("a.txt", new Uint8Array([65, 0, 66])).ok).toBe(false);
    expect(detectKind("a.txt", new Uint8Array([0xff, 0xfe, 0x41])).ok).toBe(false);
  });
  it("fayl nomi xavfsizlanadi (yo'l, maxsus belgi)", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\x\\Hisobot (1).pdf")).toBe("Hisobot-1.pdf");
    expect(safeFileName("o'quv reja.docx")).toBe("oquv-reja.docx");
    expect(safeFileName("???")).toBe("fayl");
  });
});

describe("matn ajratish va bo'laklash", () => {
  it("DOCX: abzatslar va entity'lar to'g'ri o'qiladi", () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Salom &amp; xayr</w:t></w:r></w:p><w:p><w:r><w:t>Ikkinchi abzats</w:t></w:r></w:p></w:body></w:document>';
    expect(extractDocx(makeDocx(xml))).toBe("Salom & xayr\nIkkinchi abzats");
    expect(extractText("docx", makeDocx(xml))).toContain("Ikkinchi abzats");
  });
  it("buzilgan DOCX xatosiz null qaytaradi, PDF hozircha indekslanmaydi", () => {
    expect(extractDocx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).toBeNull();
    expect(extractText("pdf", enc("%PDF-1.7"))).toBeNull();
  });
  it("TXT matni va bo'laklar: abzats chegarasida, uzun abzats bo'linadi, soni cheklanadi", () => {
    const text = ["A".repeat(600), "B".repeat(600), "C".repeat(2500), "D"].join("\n\n");
    const c = chunkText(text, 1000);
    expect(c[0]).toBe("A".repeat(600));
    expect(c.every((x) => x.length <= 1000)).toBe(true);
    expect(c.join("").replace(/\n/g, "").length).toBe(600 + 600 + 2500 + 1);
    expect(chunkText("x\n".repeat(1000), 5, 10).length).toBeLessThanOrEqual(10);
    expect(chunkText("   ")).toEqual([]);
  });
});

describe("hujjatdan qidirish (RAG uchun tayyor)", () => {
  const chunks = [
    { idx: 0, text: "Formativ baholash o'qitish jarayonida qayta aloqa berish uchun ishlatiladi." },
    { idx: 1, text: "Summativ baholash o'quv choragi oxirida natijani rasmiy qayd etadi." },
    { idx: 2, text: "Dars maqsadi o'lchanadigan fe'l bilan ifodalanadi." },
  ];
  it("savolga mos bo'lak birinchi chiqadi", () => {
    const hits = keywordRetriever.retrieve("Formativ baholash nima uchun kerak?", chunks, 2);
    expect(hits[0].idx).toBe(0);
  });
  it("mos so'z bo'lmasa bo'sh ro'yxat (uydirma manba yo'q)", () => {
    expect(keywordRetriever.retrieve("Kvant mexanikasi", chunks, 3)).toEqual([]);
    expect(keywordRetriever.retrieve("va bilan", chunks, 3)).toEqual([]);
  });
  it("apostrof turlari va qo'shimchalar moslashadi", () => {
    expect(tokens("O‘quv rejasi")).toContain("o'quv");
    expect(keywordRetriever.retrieve("maqsadlari", chunks, 1)[0]?.idx).toBe(2);
  });
  it("AI ko'rsatmasi parchalarga tayanishni va topilmasa aytishni talab qiladi", () => {
    const p = buildGroundedPrompt("Savol?", [{ idx: 0, text: "Matn A", score: 1 }]);
    expect(p.system).toMatch(/FAQAT/);
    expect(p.system).toMatch(/topilmadi/);
    expect(p.user).toContain("[1] Matn A");
  });
});

// ---------- xizmat (soxta baza va xotiradagi saqlash bilan) ----------
const h = vi.hoisted(() => {
  const s = { docs: [] as Record<string, unknown>[], chunks: [] as Record<string, unknown>[], seq: 0, failCreate: false };
  const db = {
    libraryDoc: {
      count: vi.fn(async () => s.docs.length),
      aggregate: vi.fn(async () => ({ _sum: { sizeBytes: 0 } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { if (s.failCreate) throw new Error("baza xatosi"); const d = { id: `d${++s.seq}`, createdAt: new Date(), ...data }; s.docs.push(d); return d; }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => s.docs.find((d) => d.id === where.id) ?? null),
    },
    libraryChunk: {
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => { s.chunks.push(...data); return { count: data.length }; }),
      findMany: vi.fn(async ({ where }: { where: { docId: string } }) => s.chunks.filter((c) => c.docId === where.docId)),
    },
  };
  return { s, db };
});
vi.mock("./db", () => ({ db: h.db }));
vi.mock("./audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("./notify", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("./ai/gateway", () => ({ aiAvailable: () => ({ claude: false, free: false, any: false }) }));
vi.mock("./ai/structured", () => ({ runAnyAi: vi.fn() }));

import { setStorage, type StorageService } from "./storage";
import { askDoc, uploadDoc, uploadMeta } from "./library";

const puts: string[] = []; const removed: string[] = [];
const mem = (configured: boolean): StorageService => ({ configured: () => configured, put: async (p) => { puts.push(p); }, get: async () => Buffer.alloc(0), signedUrl: async (p) => `https://x/${p}`, remove: async (p) => { removed.push(p); } });
const user = { id: "u1", roles: [{ role: "TEACHER" }] };
const meta = uploadMeta.parse({ title: "Konspekt", tags: "Baholash, Metodika" });

beforeEach(() => { h.s.docs = []; h.s.chunks = []; h.s.seq = 0; h.s.failCreate = false; puts.length = 0; removed.length = 0; setStorage(mem(true)); });

describe("yuklash xizmati", () => {
  it("saqlash xizmati ulanmagan bo'lsa 503 (storage_unconfigured), hech narsa yozilmaydi", async () => {
    setStorage(mem(false));
    await expect(uploadDoc(user, { name: "a.txt", bytes: enc("Salom") }, meta)).rejects.toMatchObject({ status: 503, code: "storage_unconfigured" });
    expect(h.s.docs).toHaveLength(0);
  });
  it("noto'g'ri fayl saqlashga yetmasdan rad etiladi", async () => {
    await expect(uploadDoc(user, { name: "a.pdf", bytes: enc("yolg'on") }, meta)).rejects.toMatchObject({ status: 400 });
    expect(puts).toHaveLength(0);
  });
  it("TXT yuklanadi: shaxsiy, indekslangan, teglar tozalangan, yo'l foydalanuvchi papkasida", async () => {
    const r = await uploadDoc(user, { name: "Konspekt.txt", bytes: enc("Birinchi abzats.\n\nIkkinchi abzats.") }, meta);
    expect(r).toMatchObject({ status: "READY", indexed: true });
    expect(puts[0]).toMatch(/^u\/u1\/[0-9a-f]{16}-Konspekt\.txt$/);
    expect(h.s.docs[0]).toMatchObject({ ownerId: "u1", tags: ["baholash", "metodika"], mime: "text/plain" });
    expect(h.s.docs[0].visibility).toBeUndefined(); // standart: PRIVATE (bazadagi default)
    expect(h.s.chunks.length).toBeGreaterThan(0);
  });
  it("PDF yuklanadi, lekin indekslanmaydi (UPLOADED)", async () => {
    const r = await uploadDoc(user, { name: "kitob.pdf", bytes: enc("%PDF-1.7\n...") }, meta);
    expect(r).toMatchObject({ status: "UPLOADED", indexed: false });
    expect(h.s.chunks).toHaveLength(0);
  });
  it("baza xato bersa, saqlangan fayl o'chiriladi (yetim fayl qolmaydi)", async () => {
    h.s.failCreate = true;
    await expect(uploadDoc(user, { name: "a.txt", bytes: enc("Salom") }, meta)).rejects.toThrow("baza xatosi");
    expect(removed).toEqual(puts);
  });
});

describe("hujjat bo'yicha savol", () => {
  it("indekslanmagan hujjatga savol berib bo'lmaydi", async () => {
    await uploadDoc(user, { name: "kitob.pdf", bytes: enc("%PDF-1.7") }, meta);
    await expect(askDoc(user, "d1", "Nima haqida?")).rejects.toMatchObject({ status: 409, code: "not_indexed" });
  });
  it("AI ulanmagan bo'lsa javob to'qilmaydi: faqat topilgan manba parchalar", async () => {
    await uploadDoc(user, { name: "k.txt", bytes: enc("Formativ baholash qayta aloqa beradi.\n\nSummativ baholash yakuniy natijani qayd etadi.") }, meta);
    const r = await askDoc(user, "d1", "Formativ baholash nima?");
    expect(r.answer).toBeNull(); expect(r.grounded).toBe(false);
    expect(r.sources[0].text).toContain("Formativ");
    expect(r.note).toMatch(/AI ulanmagan/);
  });
  it("mos joy topilmasa 'topilmadi' deyiladi", async () => {
    await uploadDoc(user, { name: "k.txt", bytes: enc("Formativ baholash qayta aloqa beradi.") }, meta);
    const r = await askDoc(user, "d1", "Kvant mexanikasi nima?");
    expect(r.sources).toEqual([]); expect(r.note).toMatch(/topilmadi/);
  });
  it("boshqa foydalanuvchining shaxsiy hujjatiga kirib bo'lmaydi", async () => {
    await uploadDoc(user, { name: "k.txt", bytes: enc("Maxfiy matn") }, meta);
    await expect(askDoc({ id: "u2", roles: [{ role: "TEACHER" }] }, "d1", "Maxfiy?")).rejects.toMatchObject({ status: 404 });
  });
});
