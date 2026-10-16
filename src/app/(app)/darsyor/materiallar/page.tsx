import { ChoiceCard, ChoiceGrid } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { DARSYOR_MATERIALS } from "@/lib/hubs";

/** Materiallar: test generatori, ko'rgazmali shablonlar va baholash materiallari alohida tab emas, shu yerdan tanlanadi. */
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Materiallar" lead="Qaysi materialni tayyorlaymiz?" back={{ href: "/darsyor", label: "DARSYOR" }} />
      <ChoiceGrid>{DARSYOR_MATERIALS.map((m) => <ChoiceCard key={m.key} mode={m} />)}</ChoiceGrid>
    </div>
  );
}
