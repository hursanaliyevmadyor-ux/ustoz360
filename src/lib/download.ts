/** Brauzerda fayl yuklab olish (server kerak emas). */
export function downloadBlob(filename: string, content: string, mime = "text/plain;charset=utf-8", bom = false) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bom ? "﻿" + content : content], { type: mime }));
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Fayl nomi uchun xavfsiz qisqa nom: "Kasrlarni solishtirish 3-sinf" -> "kasrlarni-solishtirish-3-sinf". */
export const safeName = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[‘’ʻʼ`´']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "hujjat";

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Word ochadigan .doc: oddiy HTML (formatlash saqlanadi, kutubxona kerak emas). */
export function downloadDoc(filename: string, title: string, bodyHtml: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt}h1{font-size:18pt}h2{font-size:14pt;margin-top:14pt}table{border-collapse:collapse}td,th{border:1px solid #777;padding:4pt 6pt;vertical-align:top}</style></head><body>${bodyHtml}</body></html>`;
  downloadBlob(filename, html, "application/msword;charset=utf-8", true);
}
