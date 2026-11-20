"use client";
import * as React from "react";
import qrcode from "qrcode-generator";

/** Havola uchun QR kod (telefon kamerasi bilan skanerlanadi). Brauzerda yaratiladi, hech qayerga yuborilmaydi. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const svg = React.useMemo(() => {
    if (!value) return "";
    try {
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch { return ""; }
  }, [value]);
  if (!svg) return null;
  // SVG kutubxonaning o'zi yaratadi (faqat kvadratlar): foydalanuvchi matni ichiga qo'yilmaydi.
  return <div role="img" aria-label={label} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
