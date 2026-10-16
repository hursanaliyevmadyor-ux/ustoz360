"use client";
import * as React from "react";
import { ChoiceCard, ChoiceGrid } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { BEPUL_HUB } from "@/lib/hubs";

type Free = { configured: boolean; remaining: number; limit: number };

/**
 * Bepul AI suhbat alohida ikkinchi chat sifatida takrorlanmaydi: bitta umumiy AI suhbat (/ai) bor, suhbatlar shu yerda saqlanadi.
 * Bu bo'lim bepul AI holatini ko'rsatadi va uni ochadi.
 */
export default function Page() {
  const [st, setSt] = React.useState<Free | "anon" | null | undefined>(undefined);
  React.useEffect(() => {
    fetch("/api/ai/status").then(async (r) => setSt(r.status === 401 ? "anon" : r.ok ? (await r.json()).free : null)).catch(() => setSt(null));
  }, []);
  const note = st === undefined ? null : st === "anon" ? "Bepul AI dan foydalanish uchun tizimga kiring."
    : st === null ? "Server bilan aloqa yo'q."
    : !st.configured ? "Bepul AI hali serverga ulanmagan (FREE_LLM_BASE_URL, FREE_LLM_API_KEY)."
    : `Bugun qolgan so'rovlar: ${st.remaining} / ${st.limit}. Bepul modellar xato qilishi mumkin: muhim joylarni tekshiring.`;
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="BEPUL AI" lead="Bepul AI yoki o'z obunangiz. Qaysi birini ochamiz?" />
      {note && <p className="mb-4 rounded-xl bg-muted p-3 text-sm">{note}</p>}
      <ChoiceGrid>{BEPUL_HUB.map((m) => <ChoiceCard key={m.key} mode={m} />)}</ChoiceGrid>
    </div>
  );
}
