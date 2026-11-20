import { describe, expect, it } from "vitest";
import { CLIP_CHUNK, ClipAssembler, MAX_CLIP_BYTES, clipMime, clipTime, parseChunk, splitClip, type Clip } from "./voice-clip";

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) % 256);
const clip = (n: number, ms = 5000): Clip => ({ mime: "audio/webm", ms, bytes: bytes(n) });

describe("clipMime", () => {
  it("MediaRecorder turini asosiy formatga keltiradi", () => {
    expect(clipMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(clipMime("audio/mp4")).toBe("audio/mp4");
    expect(clipMime("AUDIO/OGG; codecs=opus")).toBe("audio/ogg");
  });
  it("noma'lum turni rad etadi", () => {
    expect(clipMime("video/webm")).toBeNull();
    expect(clipMime("")).toBeNull();
    expect(clipMime("text/html")).toBeNull();
  });
});

describe("splitClip / parseChunk", () => {
  it("kichik xabar bitta paket bo'ladi va qayta o'qiladi", () => {
    const p = splitClip(7, clip(100))!;
    expect(p).toHaveLength(1);
    const c = parseChunk(p[0]!)!;
    expect(c).toMatchObject({ id: 7, index: 0, total: 1, mime: "audio/webm", ms: 5000 });
    expect([...c.data]).toEqual([...bytes(100)]);
  });
  it("katta xabar bo'laklarga bo'linadi, har bir paket chegaradan oshmaydi", () => {
    const p = splitClip(1, clip(CLIP_CHUNK * 2 + 5))!;
    expect(p).toHaveLength(3);
    for (const x of p) expect(x.length).toBeLessThanOrEqual(CLIP_CHUNK + 10);
    expect(parseChunk(p[2]!)!.data.length).toBe(5);
  });
  it("bo'sh yoki juda katta xabar yuborilmaydi", () => {
    expect(splitClip(1, clip(0))).toBeNull();
    expect(splitClip(1, clip(MAX_CLIP_BYTES + 1))).toBeNull();
    expect(splitClip(1, clip(MAX_CLIP_BYTES))).toHaveLength(16);
  });
  it("id 32 bitda saqlanadi, davomiylik 60 soniyadan oshmaydi", () => {
    const c = parseChunk(splitClip(0xffffffff, clip(10, 999_999))![0]!)!;
    expect(c.id).toBe(0xffffffff);
    expect(c.ms).toBe(60_000);
  });
  it("buzilgan paketlarni rad etadi", () => {
    const good = splitClip(1, clip(50))![0]!;
    expect(parseChunk(new Uint8Array(0))).toBeNull();
    expect(parseChunk(new Uint8Array(10))).toBeNull(); // sarlavhadan boshqa narsa yo'q
    expect(parseChunk(Uint8Array.from(good, (v, i) => (i === 0 ? 0 : v)))).toBeNull(); // sehrli bayt
    expect(parseChunk(Uint8Array.from(good, (v, i) => (i === 7 ? 9 : v)))).toBeNull(); // noma'lum format
    expect(parseChunk(Uint8Array.from(good, (v, i) => (i === 6 ? 99 : v)))).toBeNull(); // juda ko'p bo'lak
    expect(parseChunk(Uint8Array.from(good, (v, i) => (i === 5 ? 3 : v)))).toBeNull(); // tartib >= soni
    expect(parseChunk(new Uint8Array(CLIP_CHUNK + 11).fill(0x56))).toBeNull(); // juda katta
    expect(parseChunk("x" as unknown as Uint8Array)).toBeNull();
  });
});

describe("ClipAssembler", () => {
  const parts = (id: number, n: number) => splitClip(id, clip(n))!.map((p) => parseChunk(p)!);
  it("paketlarni yig'ib, asl baytlarni qaytaradi", () => {
    const a = new ClipAssembler(() => 1000);
    const ps = parts(5, CLIP_CHUNK * 2 + 77);
    expect(a.add("o-1", ps[0]!)).toBeNull();
    expect(a.add("o-1", ps[1]!)).toBeNull();
    const done = a.add("o-1", ps[2]!)!;
    expect(done.id).toBe(5);
    expect(done.mime).toBe("audio/webm");
    expect([...done.bytes]).toEqual([...bytes(CLIP_CHUNK * 2 + 77)]);
  });
  it("tartibsiz kelgan paketlar ham to'g'ri yig'iladi, takrori e'tiborga olinmaydi", () => {
    const a = new ClipAssembler(() => 1000);
    const ps = parts(5, CLIP_CHUNK + 10);
    expect(a.add("o-1", ps[1]!)).toBeNull();
    expect(a.add("o-1", ps[1]!)).toBeNull();
    expect([...a.add("o-1", ps[0]!)!.bytes]).toEqual([...bytes(CLIP_CHUNK + 10)]);
  });
  it("turli yuboruvchilar bir-biriga aralashmaydi", () => {
    const a = new ClipAssembler(() => 1000);
    const x = parts(1, CLIP_CHUNK + 1), y = parts(2, CLIP_CHUNK + 1);
    a.add("a", x[0]!); a.add("b", y[0]!);
    expect(a.add("a", x[1]!)!.id).toBe(1);
    expect(a.add("b", y[1]!)!.id).toBe(2);
  });
  it("yangi xabar boshlansa, tugallanmagan eskisi tashlanadi", () => {
    const a = new ClipAssembler(() => 1000);
    const old = parts(1, CLIP_CHUNK + 1), neu = parts(2, 10);
    a.add("a", old[0]!);
    expect(a.add("a", neu[0]!)!.id).toBe(2);
    expect(a.add("a", old[1]!)).toBeNull(); // eskisi qaytib kelsa ham xabar bo'lmaydi
  });
  it("juda tez-tez yuborilgan xabar tashlanadi, kutgandan keyin o'tadi", () => {
    let t = 1000;
    const a = new ClipAssembler(() => t);
    expect(a.add("a", parts(1, 10)[0]!)).not.toBeNull();
    t += 300;
    expect(a.add("a", parts(2, 10)[0]!)).toBeNull();
    t += 1000;
    expect(a.add("a", parts(3, 10)[0]!)!.id).toBe(3);
  });
  it("eskirgan (30 soniya) tugallanmagan xabar yangidan boshlanadi", () => {
    let t = 1000;
    const a = new ClipAssembler(() => t);
    const ps = parts(1, CLIP_CHUNK + 1);
    a.add("a", ps[0]!);
    t += 31_000;
    expect(a.add("a", ps[1]!)).toBeNull(); // eskirgan, endi bu yangi xabarning 2-bo'lagi
  });
  it("ko'p yuboruvchi bo'lsa ham xotira cheklanadi", () => {
    const a = new ClipAssembler(() => 1000, 30_000, 3);
    for (let i = 0; i < 10; i++) a.add(`u${i}`, parts(i, CLIP_CHUNK + 1)[0]!);
    expect((a as unknown as { pending: Map<string, unknown> }).pending.size).toBe(3);
  });
});

describe("clipTime", () => {
  it("daqiqa:soniya", () => {
    expect(clipTime(0)).toBe("0:00");
    expect(clipTime(7400)).toBe("0:07");
    expect(clipTime(61_000)).toBe("1:01");
    expect(clipTime(-5)).toBe("0:00");
  });
});
