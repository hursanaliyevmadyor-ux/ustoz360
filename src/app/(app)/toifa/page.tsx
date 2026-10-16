import { ChoiceCard, ChoiceGrid } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { TOIFA_HUB } from "@/lib/hubs";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="TOIFA NAVIGATOR" lead="Attestatsiya va sertifikatlash jarayonini boshqaring. Nimani ochamiz?" />
      <p className="mb-4 rounded-xl bg-amber/10 p-3 text-sm">Bu bo'limdagi reja va cheklist hozircha namunaviy: rasmiy sana va hujjatlar admin manba bilan kiritgandan keyin haqiqiy bo'ladi.</p>
      <ChoiceGrid>{TOIFA_HUB.map((m) => <ChoiceCard key={m.key} mode={m} />)}</ChoiceGrid>
    </div>
  );
}
