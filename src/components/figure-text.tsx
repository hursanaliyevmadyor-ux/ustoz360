import * as React from "react";
import { splitFigureText } from "@/lib/figure-text";

/**
 * Savol matni: oddiy matn qatorlari o'z holicha, saqlangan rasmlar (`[[rasm:egasi/nom]]`) asl joyida ko'rsatiladi.
 * Hali kesilmagan rasm joyi (`[[RASM:n]]`) bu yerda ko'rinmaydi (u faqat import tekshiruvida ko'rsatiladi).
 */
export function FigureText({ text, className }: { text: string; className?: string }) {
  const pieces = React.useMemo(() => splitFigureText(text), [text]);
  if (!pieces.some((p) => p.type !== "text")) return <span className={className} style={{ whiteSpace: "pre-line" }}>{text}</span>;
  return (
    <span className={className} style={{ whiteSpace: "pre-line" }}>
      {pieces.map((p, i) => p.type === "text" ? <React.Fragment key={i}>{p.text}</React.Fragment>
        : p.type === "image" ? (
          // Himoyalangan rasm: next/image sozlamalarisiz oddiy <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={`/api/figures/${p.path}`} alt="Savoldagi rasm" loading="lazy" className="my-2 block max-h-96 max-w-full rounded-lg border border-border bg-white object-contain" />
        ) : null)}
    </span>
  );
}
