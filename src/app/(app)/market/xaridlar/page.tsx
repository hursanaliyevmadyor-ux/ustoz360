import { Receipt } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/states";
export default function Page() {
  return (<><PageHeader module={modules[3]} title="Xaridlar" description="Chek va to'lov tarixi" />
    <EmptyState icon={Receipt} title="Xaridlar yo'q" text="To'lov tizimi ulangach, cheklar va to'lov tarixi shu yerda paydo bo'ladi." /></>);
}
