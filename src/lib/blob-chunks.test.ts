import { describe, expect, it } from "vitest";
import { BLOB_CHUNK, BlobAssembler, MAX_BLOB_BYTES, MAX_BLOB_CHUNKS, parseBlobChunk, splitBlob } from "./blob-chunks";

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 13 + 5) % 256);

describe("splitBlob / parseBlobChunk", () => {
  it("kichik rasm bitta bo'lak bo'ladi", () => {
    const p = splitBlob(7, bytes(100))!;
    expect(p).toHaveLength(1);
    expect(parseBlobChunk(p[0]!)).toMatchObject({ id: 7, index: 0, total: 1 });
  });
  it("katta rasm bo'laklarga bo'linadi, har biri chegaradan oshmaydi", () => {
    const p = splitBlob(1, bytes(BLOB_CHUNK * 3 + 5))!;
    expect(p).toHaveLength(4);
    for (const x of p) expect(x.length).toBeLessThanOrEqual(BLOB_CHUNK + 9);
    expect(parseBlobChunk(p[3]!)!.data.length).toBe(5);
  });
  it("bo'sh yoki juda katta rasm yuborilmaydi", () => {
    expect(splitBlob(1, new Uint8Array(0))).toBeNull();
    expect(splitBlob(1, bytes(MAX_BLOB_BYTES + 1))).toBeNull();
    expect(splitBlob(1, bytes(MAX_BLOB_BYTES))).toHaveLength(MAX_BLOB_CHUNKS);
  });
  it("raqam 32 bitda saqlanadi", () => {
    expect(parseBlobChunk(splitBlob(0xffffffff, bytes(10))![0]!)!.id).toBe(0xffffffff);
  });
  it("buzilgan paketlarni rad etadi", () => {
    const good = splitBlob(1, bytes(50))![0]!;
    const mod = (i: number, v: number) => Uint8Array.from(good, (x, j) => (j === i ? v : x));
    expect(parseBlobChunk(new Uint8Array(0))).toBeNull();
    expect(parseBlobChunk(new Uint8Array(9))).toBeNull();
    expect(parseBlobChunk(mod(0, 0))).toBeNull(); // sehrli bayt
    expect(parseBlobChunk(mod(8, 0))).toBeNull(); // soni 0
    expect(parseBlobChunk(mod(7, 9))).toBeNull(); // soni juda ko'p
    expect(parseBlobChunk(mod(6, 5))).toBeNull(); // tartib >= soni
    expect(parseBlobChunk(new Uint8Array(BLOB_CHUNK + 10).fill(0x49))).toBeNull();
    expect(parseBlobChunk("x" as unknown as Uint8Array)).toBeNull();
  });
});

describe("BlobAssembler", () => {
  const parts = (id: number, n: number) => splitBlob(id, bytes(n))!.map((p) => parseBlobChunk(p)!);
  it("tartibsiz va takrorlangan paketlardan ham asl baytlarni yig'adi", () => {
    const a = new BlobAssembler(() => 1000);
    const ps = parts(5, BLOB_CHUNK * 2 + 77);
    expect(a.add(ps[2]!)).toBeNull(); expect(a.add(ps[2]!)).toBeNull(); expect(a.add(ps[0]!)).toBeNull();
    const done = a.add(ps[1]!)!;
    expect(done.id).toBe(5);
    expect([...done.bytes]).toEqual([...bytes(BLOB_CHUNK * 2 + 77)]);
  });
  it("bir nechta rasm aralashmaydi", () => {
    const a = new BlobAssembler(() => 1000);
    const x = parts(1, BLOB_CHUNK + 1), y = parts(2, BLOB_CHUNK + 1);
    a.add(x[0]!); a.add(y[0]!);
    expect(a.add(y[1]!)!.id).toBe(2);
    expect(a.add(x[1]!)!.id).toBe(1);
  });
  it("eskirgan tugallanmagan rasm tashlanadi, xotira cheklangan", () => {
    let t = 1000;
    const a = new BlobAssembler(() => t, 60_000, 3);
    const ps = parts(1, BLOB_CHUNK + 1);
    a.add(ps[0]!);
    t += 61_000;
    expect(a.add(ps[1]!)).toBeNull(); // eskisi o'chgan, bu yangi rasmning 2-bo'lagi
    for (let i = 10; i < 20; i++) a.add(parts(i, BLOB_CHUNK + 1)[0]!);
    expect((a as unknown as { pending: Map<number, unknown> }).pending.size).toBe(3);
  });
  it("bo'laklar soni o'zgarsa, eskisi tashlanadi", () => {
    const a = new BlobAssembler(() => 1000);
    a.add(parts(1, BLOB_CHUNK + 1)[0]!);
    expect(a.add({ id: 1, index: 0, total: 1, data: bytes(5) })!.bytes.length).toBe(5);
  });
});
