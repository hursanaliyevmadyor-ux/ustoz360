/** Reyting sahifalari uchun tiplar (server javoblariga mos). */
export type RankEntry = { rank: number; nickname: string; avatar: string | null; direction: string | null; directionLabel: string | null; index: number; exams: number; isMe: boolean };
export type Board =
  | { enabled: false }
  | {
    enabled: true; direction: string; label: string; total: number; calibrating: boolean; minParticipants: number;
    podium: RankEntry[]; top: RankEntry[]; list: { items: RankEntry[]; page: number; pages: number; total: number; q: string };
  };
export type DirectionTab = { key: string; label: string; count: number };
export type MyRank = {
  enabled: boolean; nickname: string | null; avatar: string | null; optIn: boolean; hidden: boolean;
  direction: string | null; directionLabel: string | null; ranked: boolean;
  overall: { rank: number; total: number; index: number; exams: number } | null; inDirection: { rank: number; total: number; index: number; exams: number } | null;
  index: number | null; counted: { exams: number; diagnostics: number }; blockers: string[]; comparing: boolean; nextStep: { text: string; href: string } | null;
  personal: { exams: { title: string; percent: number; counted: boolean }[]; diagnosticPercent: number | null; diagnostics: number }; minParticipants: number;
};

export const MEDAL = {
  1: { label: "1-o'rin", color: "#D4A72C", name: "Oltin" },
  2: { label: "2-o'rin", color: "#9AA7B8", name: "Kumush" },
  3: { label: "3-o'rin", color: "#B98255", name: "Bronza" },
} as const;
