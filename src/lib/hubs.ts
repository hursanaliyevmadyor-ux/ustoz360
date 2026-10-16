import { ClipboardList, ExternalLink, FileText, FolderCheck, ListChecks, Route, Shapes, Sparkles } from "lucide-react";
import type { ChoiceDef } from "@/lib/choices";

/** Modullarning umumiy sahifalaridagi "keyingi qadamni tanlang" kartalari. USTOZ AI uchun: components/tests/modes.ts. */

export const DARSYOR_HUB: ChoiceDef[] = [
  { key: "lesson", title: "Dars ishlanmasi", desc: "Maqsad, bosqichlar, baholash va uy vazifasi bilan. AI qoralama yozadi, siz tahrirlaysiz.", benefit: "Tayyorlanish vaqtini kamaytiring", icon: FileText, tone: "amber", href: "/darsyor/dars-ishlanmasi", cta: "Yaratish" },
  { key: "materials", title: "Materiallar", desc: "Test generatori, ko'rgazmali shablonlar va baholash materiallari bitta joyda.", benefit: "Dars uchun tayyor vositalar", icon: Shapes, tone: "blue", href: "/darsyor/materiallar", cta: "Tanlash" },
];

export const DARSYOR_MATERIALS: ChoiceDef[] = [
  { key: "test", title: "Test generatori", desc: "O'quvchilar uchun 8 turdagi savol, javob va izoh bilan. Sinf tahlilidagi individual topshiriqlar ham shu yerda tayyorlanadi.", benefit: "Savollar tayyorlash", icon: ListChecks, tone: "teal", href: "/darsyor/test-generator", cta: "Ochish", tag: "AI ulangach ishlaydi" },
  { key: "visual", title: "Ko'rgazmali materiallar", desc: "Venn, klaster, Frayer, baliq skeleti kabi tahrirlanadigan shablonlar.", benefit: "Dars uchun vizual vositalar", icon: Shapes, tone: "violet", href: "/darsyor/korgazma", cta: "Ochish", tag: "Muharrir tez orada" },
  { key: "assess", title: "Baholash materiallari", desc: "Rubrika, mezonlar va kuzatuv varaqalari. Rubrikani CSV qilib yuklab olish mumkin.", benefit: "Aniq baholash mezonlari", icon: ClipboardList, tone: "rose", href: "/darsyor/baholash", cta: "Ochish" },
];

export const TOIFA_HUB: ChoiceDef[] = [
  { key: "plan", title: "Reja", desc: "Imtihongacha yo'l xaritasi, tayyorgarlik kalendari va kunlik reja bir joyda.", benefit: "Bosqichma-bosqich tayyorgarlik", icon: Route, tone: "teal", href: "/toifa/reja", cta: "Ochish", tag: "Namunaviy" },
  { key: "docs", title: "Hujjatlar", desc: "Hujjatlar cheklisti va rasmiy ma'lumotlar manbasi bilan.", benefit: "Hech narsani unutmang", icon: FolderCheck, tone: "blue", href: "/toifa/hujjatlar", cta: "Ochish", tag: "Namunaviy" },
];

export const BEPUL_HUB: ChoiceDef[] = [
  { key: "chat", title: "Bepul AI suhbat", desc: "Savolingizni yozing: AI o'zbek tilida javob beradi. Suhbatlaringiz saqlanadi.", benefit: "Bitta umumiy AI suhbat", icon: Sparkles, tone: "teal", href: "/ai", cta: "Suhbatni ochish" },
  { key: "subs", title: "Mening AI obunalarim", desc: "Claude, ChatGPT va Gemini obunangizni saytning yonida alohida oynada oching.", benefit: "O'z obunangizdan foydalaning", icon: ExternalLink, tone: "blue", href: "/bepul-ai/obunalarim", cta: "Ochish" },
];
