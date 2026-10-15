import { courses, fmt } from "@/lib/demo";
import { adminModule } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const status = ["Tasdiqlangan", "Tasdiqlangan", "Tekshiruvda", "Tasdiqlangan", "Tekshiruvda", "Rad etilgan"];
export default function Page() {
  return (
    <>
      <PageHeader module={adminModule} title="Kurslar" description="Muallif mahsulotlari moderatsiyasi" demo />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.map((c, i) => (
        <Card key={c.id} className="p-5"><Badge variant="blue">{c.tag}</Badge><p className="mt-3 font-extrabold leading-snug">{c.title}</p><p className="text-sm text-muted-foreground">{c.author}</p>
          <div className="mt-4 flex items-center justify-between"><b>{fmt(c.price)}</b><Badge variant={status[i] === "Tasdiqlangan" ? "success" : status[i] === "Tekshiruvda" ? "amber" : "danger"}>{status[i]}</Badge></div></Card>))}</div>
    </>
  );
}
