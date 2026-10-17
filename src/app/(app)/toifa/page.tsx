import { ChoiceCard, ChoiceGrid } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { TOIFA_HUB } from "@/lib/hubs";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="TOIFA NAVIGATOR" lead="Attestatsiya va sertifikatlash jarayonini boshqaring. Nimani ochamiz?" />
      <ChoiceGrid>{TOIFA_HUB.map((m) => <ChoiceCard key={m.key} mode={m} />)}</ChoiceGrid>
    </div>
  );
}
