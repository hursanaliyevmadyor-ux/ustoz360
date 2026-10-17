import { seededShuffle, TASK_LABEL, type TaskItem } from "@/server/docsvalid";

const LETTERS = "ABCDEFGH";

/** Chop etiladigan varaq: o'quvchi varag'ida javob va izohlar yo'q; o'qituvchi kalitida bor. Faqat tasdiqlangan topshiriqlar. */
export function TaskSheet({ items, title, meta, teacher }: { items: TaskItem[]; title: string; meta: string; teacher: boolean }) {
  const list = items.filter((t) => t.approved);
  return (
    <div className={teacher ? "print-teacher" : "print-student"}>
      <h2 className="text-xl font-extrabold">{title}{teacher ? " — o'qituvchi kaliti" : ""}</h2>
      <p className="mb-4 text-sm">{meta}</p>
      {!teacher && <p className="mb-4 text-sm">Ism-familiya: ____________________________ &nbsp; Sana: ____________</p>}
      <ol className="space-y-5">
        {list.map((t, i) => (
          <li key={i} className="print-break">
            <p className="font-semibold">{i + 1}. {t.text} <span className="text-xs font-normal text-muted-foreground">({TASK_LABEL[t.type]})</span></p>
            {(t.type === "single" || t.type === "multi") && (
              <ul className="mt-1 space-y-0.5 pl-4">{t.options.map((o, k) => {
                const ok = teacher && t.correct.includes(k);
                return <li key={k} className={ok ? "font-bold" : undefined}>{ok ? "✔ " : t.type === "multi" ? "☐ " : "○ "}{LETTERS[k]}) {o}</li>;
              })}</ul>)}
            {t.type === "order" && (
              <ul className="mt-1 space-y-0.5 pl-4">{(teacher ? t.options : seededShuffle(t.options, t.text)).map((o, k) => <li key={k}>{teacher ? `${k + 1}. ` : "[__] "}{o}</li>)}</ul>)}
            {t.type === "order" && teacher && <p className="mt-1 pl-4 text-xs text-muted-foreground">To'g'ri tartib yuqorida ko'rsatilgan (o'quvchi varag'ida bandlar aralash).</p>}
            {t.type === "match" && (() => {
              // O'ng ustun ikkala varaqda ham bir xil aralashtiriladi, kalit shunga mos.
              const shuffled = seededShuffle(t.pairs.map((p) => p.r), t.text);
              return (
                <>
                  <div className="mt-1 grid grid-cols-2 gap-x-8 pl-4">
                    <ul>{t.pairs.map((p, k) => <li key={k}>{k + 1}. {p.l}</li>)}</ul>
                    <ul>{shuffled.map((r, k) => <li key={k}>{LETTERS[k]}) {r}</li>)}</ul>
                  </div>
                  {teacher && <p className="mt-1 pl-4 text-sm">Javob: {t.pairs.map((p, k) => `${k + 1}-${LETTERS[shuffled.indexOf(p.r)]}`).join(", ")}</p>}
                </>
              );
            })()}
            {(["open", "situation", "logic", "text"] as const).includes(t.type as "open") && !teacher && <div className="mt-2 space-y-4 pl-4" aria-hidden>{[0, 1, 2].map((k) => <div key={k} className="border-b border-border" style={{ height: 18 }} />)}</div>}
            {teacher && t.answer && <p className="mt-1 pl-4 text-sm"><b>Javob / mezon:</b> {t.answer}</p>}
            {teacher && t.explanation && <p className="mt-1 pl-4 text-sm text-muted-foreground"><b>Izoh:</b> {t.explanation}</p>}
          </li>))}
      </ol>
      {list.length === 0 && <p className="text-sm">Tasdiqlangan topshiriq yo'q.</p>}
    </div>
  );
}
