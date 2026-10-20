import { describe, expect, it } from "vitest";
import { decodeText, detectImportKind, extOf, pdfEncrypted, safeFileName } from "./formats";
import { buildZip } from "./zipx";

const u8 = (s: string | Buffer) => new Uint8Array(typeof s === "string" ? Buffer.from(s, "latin1") : s);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

describe("fayl turini aniqlash", () => {
  it("haqiqiy PDF qabul qilinadi, soxta PDF rad etiladi", () => {
    expect(detectImportKind("test.pdf", u8("%PDF-1.4\n...%%EOF"))).toMatchObject({ ok: true, kind: "pdf" });
    expect(detectImportKind("test.pdf", u8("bu matn"))).toMatchObject({ ok: false, code: "mismatch" });
  });
  it("parol bilan himoyalangan PDF", () => {
    const bytes = u8("%PDF-1.7\n" + "x".repeat(100) + "\ntrailer << /Encrypt 5 0 R /Root 1 0 R >>\n%%EOF");
    expect(pdfEncrypted(bytes)).toBe(true);
    expect(detectImportKind("a.pdf", bytes)).toMatchObject({ ok: false, code: "encrypted" });
  });
  it("eski Office formatlari tushunarli xabar bilan rad etiladi", () => {
    for (const n of ["a.doc", "b.xls", "c.ppt"]) {
      const r = detectImportKind(n, u8("\xd0\xcf\x11\xe0abc"));
      expect(r).toMatchObject({ ok: false, code: "legacy" });
      if (!r.ok) expect(r.error).toMatch(/Boshqacha saqlash/);
    }
  });
  it("DOCX/XLSX/PPTX: ichki tuzilma tekshiriladi", () => {
    expect(detectImportKind("a.docx", buildZip({ "word/document.xml": "<w:document/>" }))).toMatchObject({ ok: true, kind: "docx" });
    expect(detectImportKind("a.docx", buildZip({ "xl/workbook.xml": "<x/>" }))).toMatchObject({ ok: false, code: "mismatch" });
    expect(detectImportKind("a.xlsx", buildZip({ "xl/workbook.xml": "<x/>" }))).toMatchObject({ ok: true, kind: "xlsx" });
    expect(detectImportKind("a.pptx", buildZip({ "ppt/presentation.xml": "<p/>" }))).toMatchObject({ ok: true, kind: "pptx" });
    expect(detectImportKind("a.docx", u8("PK\x03\x04 buzilgan"))).toMatchObject({ ok: false });
  });
  it("OpenDocument: mimetype kengaytmaga mos bo'lishi shart", () => {
    const odt = buildZip({ mimetype: "application/vnd.oasis.opendocument.text", "content.xml": "<c/>" });
    expect(detectImportKind("a.odt", odt)).toMatchObject({ ok: true, kind: "odt" });
    expect(detectImportKind("a.ods", odt)).toMatchObject({ ok: false, code: "mismatch" });
  });
  it("rasm: magic bytes", () => {
    expect(detectImportKind("a.png", PNG)).toMatchObject({ ok: true, kind: "image", mime: "image/png" });
    expect(detectImportKind("a.jpg", JPG)).toMatchObject({ ok: true, mime: "image/jpeg" });
    expect(detectImportKind("a.webp", WEBP)).toMatchObject({ ok: true, mime: "image/webp" });
    expect(detectImportKind("a.png", JPG).ok).toBe(true); // tarkib rasm: kengaytma bilan emas, tarkib bo'yicha MIME beriladi
    expect(detectImportKind("a.png", u8("GIF89a..."))).toMatchObject({ ok: false, code: "mismatch" });
  });
  it("matn va CSV: ikkilik belgilar rad etiladi, kirill (windows-1251) zaxirasi ishlaydi", () => {
    expect(detectImportKind("a.txt", u8("1. Savol\nA) bir"))).toMatchObject({ ok: true, kind: "txt" });
    expect(detectImportKind("a.csv", new Uint8Array(Buffer.from("a;b\n1;2")))).toMatchObject({ ok: true, kind: "csv" });
    expect(detectImportKind("a.txt", new Uint8Array([0x41, 0, 0x42, 0]))).toMatchObject({ ok: false, code: "binary" });
    expect(decodeText(new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]))).toBe("Привет");
    expect(decodeText(new Uint8Array(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("salom")])))).toBe("salom");
  });
  it("noma'lum tur, bo'sh fayl va nomlar", () => {
    expect(detectImportKind("a.exe", u8("MZ"))).toMatchObject({ ok: false, code: "unsupported" });
    expect(detectImportKind("a.pdf", new Uint8Array())).toMatchObject({ ok: false, code: "empty" });
    expect(extOf("Hujjat.Test.DOCX")).toBe("docx");
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("Test savollari (1).pdf")).toBe("Test-savollari-1.pdf");
  });
});
