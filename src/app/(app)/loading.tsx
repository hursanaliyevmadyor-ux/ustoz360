import { BookLoader } from "@/components/book-loader";

/** Bo'limlar orasida o'tishda ko'rinadigan umumiy yuklash belgisi. */
export default function Loading() {
  return <div className="grid min-h-[50vh] place-items-center"><BookLoader size="lg" label="Yuklanmoqda…" /></div>;
}
