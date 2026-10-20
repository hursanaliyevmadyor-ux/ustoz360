import { describe, expect, it } from "vitest";
import { extractOfficeText, formatNumber, parseCsv } from "./officetext";
import { parseQuestions } from "./qparse";
import { buildZip } from "./zipx";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (t: string, num?: { id: number; lvl: number }) => `<w:p>${num ? `<w:pPr><w:numPr><w:ilvl w:val="${num.lvl}"/><w:numId w:val="${num.id}"/></w:numPr></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const docx = (body: string, extra: Record<string, string> = {}) => buildZip({ "word/document.xml": `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`, ...extra });

describe("DOCX matni", () => {
  it("abzatslar va jadval qatorlari", () => {
    const tbl = `<w:tbl><w:tr><w:tc>${para("№")}</w:tc><w:tc>${para("Savol")}</w:tc><w:tc>${para("A")}</w:tc></w:tr><w:tr><w:tc>${para("1")}</w:tc><w:tc>${para("2+2?")}</w:tc><w:tc>${para("4")}</w:tc></w:tr></w:tbl>`;
    const r = extractOfficeText("docx", docx(para("Sarlavha") + tbl + para("Oxiri")))!;
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].text).toBe("Sarlavha\n№ | Savol | A\n1 | 2+2? | 4\nOxiri");
  });
  it("Word avtoraqamlash matnga qo'shiladi (1., 2. va A), B))", () => {
    const numbering = `<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%2)"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
    const body = para("Birinchi savol?", { id: 1, lvl: 0 }) + para("bir", { id: 1, lvl: 1 }) + para("ikki", { id: 1, lvl: 1 }) + para("Ikkinchi savol?", { id: 1, lvl: 0 }) + para("uch", { id: 1, lvl: 1 });
    const r = extractOfficeText("docx", docx(body, { "word/numbering.xml": numbering }))!;
    expect(r.pages[0].text).toBe("1. Birinchi savol?\nA) bir\nB) ikki\n2. Ikkinchi savol?\nA) uch");
    const q = parseQuestions(r.pages);
    expect(q.questions).toHaveLength(2);
    expect(q.questions[0].options.map((o) => o.text)).toEqual(["bir", "ikki"]);
  });
  it("sahifa uzilishi sahifalarni ajratadi; rasmlar haqida ogohlantirish", () => {
    const body = para("Bir") + `<w:p><w:r><w:br w:type="page"/></w:r></w:p>` + para("Ikki") + `<w:p><w:r><w:drawing/></w:r></w:p>`;
    const r = extractOfficeText("docx", docx(body))!;
    expect(r.pages.map((p) => p.label)).toEqual(["Sahifa 1", "Sahifa 2"]);
    expect(r.images).toBe(1);
    expect(r.note).toMatch(/rasm/);
  });
  it("noto'g'ri zip yoki bo'sh hujjat", () => {
    expect(extractOfficeText("docx", new Uint8Array([1, 2, 3]))).toBeNull();
    expect(extractOfficeText("docx", docx(""))!.pages).toEqual([]);
  });
});

describe("XLSX, PPTX, ODT matni", () => {
  it("XLSX: varaq nomi, umumiy satrlar, bo'sh kataklar", () => {
    const wb = `<workbook><sheets><sheet name="Test" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const rels = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`;
    const ss = `<sst><si><t>Savol</t></si><si><t>Variant A</t></si><si><t>2+2?</t></si></sst>`;
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>4</v></c></row></sheetData></worksheet>`;
    const r = extractOfficeText("xlsx", buildZip({ "xl/workbook.xml": wb, "xl/_rels/workbook.xml.rels": rels, "xl/sharedStrings.xml": ss, "xl/worksheets/sheet1.xml": sheet }))!;
    expect(r.pages).toEqual([{ label: "Varaq «Test»", text: "Savol |  | Variant A\n2+2? | 4" }]);
  });
  it("PPTX: slaydlar tartibi va matni", () => {
    const slide = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`;
    const r = extractOfficeText("pptx", buildZip({ "ppt/presentation.xml": "<p/>", "ppt/slides/slide2.xml": slide("Ikkinchi"), "ppt/slides/slide1.xml": slide("Birinchi") }))!;
    expect(r.pages).toEqual([{ label: "Slayd 1", text: "Birinchi" }, { label: "Slayd 2", text: "Ikkinchi" }]);
  });
  it("ODT: ro'yxat avtoraqamlash va oddiy abzatslar", () => {
    const content = `<office:document-content><office:automatic-styles><text:list-style style:name="L1"><text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix="."/></text:list-style></office:automatic-styles><office:body><office:text><text:p>Sarlavha</text:p><text:list text:style-name="L1"><text:list-item><text:p>Bir</text:p></text:list-item><text:list-item><text:p>Ikki</text:p></text:list-item></text:list></office:text></office:body></office:document-content>`;
    const r = extractOfficeText("odt", buildZip({ mimetype: "application/vnd.oasis.opendocument.text", "content.xml": content }))!;
    expect(r.pages[0].text).toBe("Sarlavha\n1. Bir\n2. Ikki");
  });
  it("ODS: varaqlar va qatorlar", () => {
    const content = `<office:document-content><office:body><office:spreadsheet><table:table table:name="Savollar"><table:table-row><table:table-cell><text:p>1</text:p></table:table-cell><table:table-cell><text:p>2+2?</text:p></table:table-cell><table:table-cell table:number-columns-repeated="50"/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>`;
    const r = extractOfficeText("ods", buildZip({ mimetype: "application/vnd.oasis.opendocument.spreadsheet", "content.xml": content }))!;
    expect(r.pages).toEqual([{ label: "Varaq «Savollar»", text: "1 | 2+2?" }]);
  });
});

describe("CSV, TXT va raqamlash", () => {
  it("CSV: nuqtali vergul, qo'shtirnoq va jadvalga aylanishi", () => {
    expect(parseCsv('№;Savol;A\n1;"Bir; ikki?";x\n')).toEqual([["№", "Savol", "A"], ["1", "Bir; ikki?", "x"]]);
    const r = extractOfficeText("csv", new Uint8Array(Buffer.from("1,2+2?,4\n2,3+3?,6")))!;
    expect(r.pages[0].text).toBe("1 | 2+2? | 4\n2 | 3+3? | 6");
  });
  it("TXT sahifalarga bo'linadi", () => {
    const r = extractOfficeText("txt", new Uint8Array(Buffer.from("Bir\fIkki")))!;
    expect(r.pages.map((p) => p.text)).toEqual(["Bir", "Ikki"]);
  });
  it("raqamlash formatlari", () => {
    expect(formatNumber(3, "upperLetter")).toBe("C");
    expect(formatNumber(28, "lowerLetter")).toBe("ab");
    expect(formatNumber(4, "upperRoman")).toBe("IV");
    expect(formatNumber(2, "russianUpper")).toBe("Б");
    expect(formatNumber(7, "decimal")).toBe("7");
  });
  it("PDF va rasm bu yerda ishlanmaydi", () => {
    expect(extractOfficeText("pdf", new Uint8Array([1]))).toBeNull();
    expect(extractOfficeText("image", new Uint8Array([1]))).toBeNull();
  });
});
