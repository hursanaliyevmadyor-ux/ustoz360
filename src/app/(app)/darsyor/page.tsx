import { ChoiceCard, ChoiceGrid } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { RecentDocs } from "@/components/darsyor/recent";
import { DARSYOR_HUB } from "@/lib/hubs";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="DARSYOR" lead="Kundalik darsga tayyorlanish vaqtini kamaytiring. Nimani tayyorlaymiz?" />
      <ChoiceGrid>{DARSYOR_HUB.map((m) => <ChoiceCard key={m.key} mode={m} />)}</ChoiceGrid>
      <RecentDocs />
    </div>
  );
}
