/** Bilim laboratoriyasi uchun yengil SVG rasmlar (tashqi rasm fayllari kerak emas). */
type P = { className?: string };

export function RobotArt({ className }: P) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <ellipse cx="60" cy="113" rx="26" ry="4" fill="#102A4C" opacity=".08" />
      <line x1="60" y1="12" x2="60" y2="26" stroke="#9DB1D6" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="10" r="6" fill="#3867F4" />
      <circle cx="21" cy="52" r="8" fill="#3867F4" />
      <circle cx="99" cy="52" r="8" fill="#3867F4" />
      <rect x="26" y="26" width="68" height="54" rx="24" fill="#fff" stroke="#C9D5EC" strokeWidth="3" />
      <rect x="34" y="35" width="52" height="36" rx="16" fill="#12305A" />
      <circle cx="49" cy="52" r="6" fill="#5EE1FF" />
      <circle cx="71" cy="52" r="6" fill="#5EE1FF" />
      <circle cx="51" cy="50" r="2" fill="#fff" />
      <circle cx="73" cy="50" r="2" fill="#fff" />
      <path d="M52 62 Q60 68 68 62" stroke="#5EE1FF" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="40" y="84" width="40" height="26" rx="12" fill="#3867F4" />
      <circle cx="60" cy="97" r="5" fill="#fff" opacity=".85" />
    </svg>
  );
}

export function TrophyArt({ className }: P) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <ellipse cx="60" cy="112" rx="28" ry="4" fill="#102A4C" opacity=".08" />
      <path d="M30 26 H90 V50 C90 70 76 82 60 82 C44 82 30 70 30 50 Z" fill="#F7B731" />
      <path d="M30 34 H16 C16 52 24 60 36 62 M90 34 H104 C104 52 96 60 84 62" stroke="#F0A30A" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M40 30 H52 V62 C46 58 40 52 40 44 Z" fill="#fff" opacity=".35" />
      <rect x="54" y="82" width="12" height="14" fill="#F0A30A" />
      <rect x="40" y="96" width="40" height="12" rx="4" fill="#F7B731" />
      <path d="M60 36 L64 46 L75 47 L67 54 L69 65 L60 59 L51 65 L53 54 L45 47 L56 46 Z" fill="#fff" opacity=".9" />
    </svg>
  );
}

// Bezak matn ustiga tushmasligi uchun faqat chetlarga joylashtirilgan.
const CONFETTI = [
  [6, 14, "#3867F4", 0], [16, 8, "#F7B731", 30], [24, 34, "#0D9E91", 60], [10, 52, "#E54D4D", 70], [20, 74, "#3867F4", 20], [4, 36, "#F7B731", 45],
  [98, 12, "#F7B731", 45], [88, 6, "#3867F4", 80], [80, 30, "#E54D4D", 15], [96, 50, "#0D9E91", 55], [84, 70, "#F7B731", 10], [92, 80, "#E54D4D", 65],
] as const;
/** Yengil bayram effekti: faqat bezak, harakatsiz. */
export function Confetti({ className }: P) {
  return (
    <svg viewBox="0 0 104 90" className={className} aria-hidden preserveAspectRatio="none">
      {CONFETTI.map(([x, y, c, r], i) => <rect key={i} x={x} y={y} width="5" height="9" rx="1.5" fill={c} transform={`rotate(${r} ${x} ${y})`} opacity=".85" />)}
    </svg>
  );
}
