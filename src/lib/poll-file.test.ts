import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, cleanFileName, fmtSize, kindOfMime, parsePollFile, sniffFile } from "./poll-file";

const bytes = (sig: number[], pad = 20) => Uint8Array.from([...sig, ...new Array(pad).fill(1)]);
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d], PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], JPG = [0xff, 0xd8, 0xff, 0xe0], ZIP = [0x50, 0x4b, 0x03, 0x04], OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 9, 9]);

describe("sniffFile", () => {
  it("rasm va PDF fayl ichidagi belgi bo'yicha aniqlanadi (nomga ishonilmaydi)", () => {
    expect(sniffFile(bytes(PDF), "x.pdf")).toMatchObject({ kind: "pdf", mime: "application/pdf" });
    expect(sniffFile(bytes(PDF), "nom.txt")).toMatchObject({ kind: "pdf" });
    expect(sniffFile(bytes(PNG), "a.png")).toMatchObject({ kind: "image", mime: "image/png" });
    expect(sniffFile(bytes(JPG), "a.jpg")).toMatchObject({ kind: "image", mime: "image/jpeg" });
    expect(sniffFile(webp, "a.webp")).toMatchObject({ kind: "image", mime: "image/webp" });
  });
  it("Word, Excel, PowerPoint: ZIP va OLE belgisi + mos kengaytma", () => {
    expect(sniffFile(bytes(ZIP), "dars.docx")).toMatchObject({ kind: "word" });
    expect(sniffFile(bytes(ZIP), "jadval.XLSX")).toMatchObject({ kind: "excel" });
    expect(sniffFile(bytes(ZIP), "slayd.pptx")).toMatchObject({ kind: "ppt" });
    expect(sniffFile(bytes(OLE), "eski.doc")).toMatchObject({ kind: "word", mime: "application/msword" });
    expect(sniffFile(bytes(OLE), "eski.xls")).toMatchObject({ kind: "excel" });
    expect(sniffFile(bytes(OLE), "eski.ppt")).toMatchObject({ kind: "ppt" });
  });
  it("noma'lum turlar, ZIP/OLE noto'g'ri kengaytma bilan va juda kichik fayllar rad etiladi", () => {
    expect(sniffFile(bytes(ZIP), "arxiv.zip")).toBeNull();
    expect(sniffFile(bytes(ZIP), "fayl")).toBeNull();
    expect(sniffFile(bytes(OLE), "x.msi")).toBeNull();
    expect(sniffFile(new TextEncoder().encode("<html><script>alert(1)</script></html>"), "x.html")).toBeNull();
    expect(sniffFile(new TextEncoder().encode("MZ........exe....."), "x.exe")).toBeNull();
    expect(sniffFile(new Uint8Array(3), "x.pdf")).toBeNull();
    expect(sniffFile(new Uint8Array(0), "x.pdf")).toBeNull();
    expect(sniffFile(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20, 1]), "x.avi")).toBeNull(); // RIFF, lekin WEBP emas
  });
});

describe("cleanFileName", () => {
  it("yo'l va xavfli belgilar olib tashlanadi, uzunlik cheklanadi, kengaytma saqlanadi", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("etc passwd");
    expect(cleanFileName("C:\\Users\\Ali\\dars.docx")).toBe("C Users Ali dars.docx");
    expect(cleanFileName('a<b>"c|d?.pdf')).toBe("a b c d .pdf");
    expect(cleanFileName("  .hidden.pdf ")).toBe("hidden.pdf");
    expect(cleanFileName("x".repeat(200) + ".xlsx")).toHaveLength(80);
    expect(cleanFileName("x".repeat(200) + ".xlsx").endsWith(".xlsx")).toBe(true);
    expect(cleanFileName("a\u0000b\nc.pdf")).toBe("a b c.pdf");
    for (const bad of [null, undefined, 5, {}, ""]) expect(cleanFileName(bad)).toBe("");
  });
});

describe("fmtSize / kindOfMime", () => {
  it("hajm matni", () => {
    expect(fmtSize(0)).toBe("0 B"); expect(fmtSize(999)).toBe("999 B"); expect(fmtSize(12_400)).toBe("12 KB"); expect(fmtSize(1_500_000)).toBe("1,5 MB"); expect(fmtSize(-1)).toBe(""); expect(fmtSize(NaN)).toBe("");
  });
  it("mime turi: faqat ro'yxatdagi, prototip kalitlari emas", () => {
    expect(kindOfMime("application/pdf")).toBe("pdf");
    for (const bad of ["text/html", "constructor", "__proto__", "toString", "", null, 5]) expect(kindOfMime(bad)).toBeNull();
  });
});

describe("parsePollFile", () => {
  const ok = { id: 5, name: "dars.pdf", mime: "application/pdf", size: 1234 };
  it("to'g'ri ma'lumot o'tadi, nom tozalanadi, tur mime'dan olinadi", () => {
    expect(parsePollFile(ok)).toEqual({ ...ok, kind: "pdf" });
    expect(parsePollFile({ ...ok, name: "../x.pdf" })!.name).toBe("x.pdf");
  });
  it("yaroqsizlar rad etiladi", () => {
    for (const bad of [null, 5, "x", [], {}, { ...ok, mime: "text/html" }, { ...ok, name: "" }, { ...ok, size: 0 }, { ...ok, size: MAX_FILE_BYTES + 1 }, { ...ok, size: 1.5 }, { ...ok, id: -1 }, { ...ok, id: "5" }, { ...ok, mime: "constructor" }]) expect(parsePollFile(bad), JSON.stringify(bad)).toBeNull();
    expect(parsePollFile({ ...ok, size: MAX_FILE_BYTES })).not.toBeNull();
  });
});
