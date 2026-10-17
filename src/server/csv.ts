/** CSV yaratish. Excel'da formula sifatida ishga tushmasligi uchun =, +, -, @ bilan boshlangan katakka ' qo'shiladi. */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const head = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(","));
  // BOM: Excel o'zbek (lotin) harflarini to'g'ri o'qishi uchun.
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}
