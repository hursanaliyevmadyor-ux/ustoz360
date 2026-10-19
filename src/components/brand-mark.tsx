import { cn } from "@/lib/utils";

/**
 * USTOZ 360 belgisi: foydalanuvchi bergan logotip rasmiga qarab vektor (SVG) shaklida chizilgan.
 * `dark` — qorong'u fon uchun: to'q ko'k qismlar oq bo'ladi. Asl fayl: public/logo.svg.
 */
export function BrandMark({ className, dark }: { className?: string; dark?: boolean }) {
  const navy = dark ? "#FFFFFF" : "#0B2D6B";
  const cyan = "#00C6D7";
  return (
    <svg viewBox="347 310 564 574" className={cn("shrink-0", className)} aria-hidden="true" focusable="false">
      <g transform="translate(629 598) scale(1 1.0382)">
        <path fill={cyan} d="M-164.9,-203.6A247.1 247.1 0 0 1 226.9,-131A280.8 280.8 0 0 0 -164.9,-203.6Z" />
        <path fill={cyan} d="M260,-31.9A212 212 0 0 1 188.5,182A353.1 353.1 0 0 0 260,-31.9Z" />
        <path fill={navy} d="M164.9,203.6A246.8 246.8 0 0 1 -224.6,134.9A281.5 281.5 0 0 0 164.9,203.6Z" />
        <path fill={navy} d="M-258.8,41A187.5 187.5 0 0 1 -224.6,-134.9A460.5 460.5 0 0 0 -258.8,41Z" />
      </g>
      <circle cx="877" cy="512" r="30" fill={cyan} />
      <circle cx="385" cy="697" r="30" fill={navy} />
      <g fill={navy}>
        <path d="M478,470Q478,459 490,460L579,566Q581,569 578,573L571,632V742L478,628Z" />
        <path d="M689,493H777V662H720V738L641,832H627V658L720,541A20 20 0 0 0 689,515Z" />
      </g>
      <g fill="none" stroke={navy} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
        <path d="M533,412L612,512C632,536 624,566 598,572" />
        <path d="M777,437H620Q596,437 596,461V470" />
        <path d="M577,792V636L686,513" />
      </g>
    </svg>
  );
}
