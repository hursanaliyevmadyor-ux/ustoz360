import { norm } from "../rag";

/**
 * Savol internetdan yangi/rasmiy ma'lumot talab qiladimi yoki tayyor material (test, namuna) izlanyaptimi: qoidalar bilan aniqlanadi (AI chaqirilmaydi).
 * Umumiy bilim savollari ("fotosintez nima?") va yaratish so'rovlari ("dars rejasi tuzib ber") internetga chiqmaydi.
 */
export type Spec = { grade?: number; quarter?: number; year?: number; schoolYear: string; subject?: string };
export type Intent = { needsFresh: boolean; wantsMaterial: boolean; officialLike: boolean; explicit: boolean; spec: Spec };

const SUBJECTS: [string, RegExp][] = [
  ["matematika", /\b(matematika|algebra|geometriya)/], ["fizika", /\bfizika/], ["kimyo", /\bkimyo/], ["biologiya", /\bbiologiya/],
  ["ona tili", /\bona\s*tili|\bonatili/], ["adabiyot", /\badabiyot/], ["tarix", /\btarix/], ["geografiya", /\bgeografiya/],
  ["informatika", /\binformatika/], ["ingliz tili", /\bingliz/], ["rus tili", /\brus\s*tili/], ["texnologiya", /\btexnologiya/],
  ["huquq", /\bhuquq/], ["iqtisodiyot", /\biqtisod/], ["tabiiy fan", /\btabiiy\s*fan/], ["musiqa", /\bmusiqa/], ["jismoniy tarbiya", /\bjismoniy\s*tarbiya/],
];
/** Matnda shu fan tilga olinganmi (natijaning mosligini tekshirish uchun). */
export const subjectMentioned = (text: string, subject: string) => { const re = SUBJECTS.find(([n]) => n === subject)?.[1]; return !!re && re.test(norm(text)); };

const WORD_QUARTER: Record<string, number> = { birinchi: 1, ikkinchi: 2, uchinchi: 3, "to'rtinchi": 4 };

const FRESH = /\b(yangi|yangilik|yangilandi|yangilangan|hozir|bugun|joriy|so'nggi|oxirgi|qachon|muddat|sanasi|e'lon|qaror|buyruq|farmon|qonun|nizom|qoida|qoidalar|tartib|me'yoriy|vazirlik|dtm|attestatsiya|malaka oshirish|sertifikat|toifa|ish haqi|oylik|maosh|stipendiya|nafaqa|ro'yxatdan o'tish|qabul|kvota|narx|to'lov|imtihon|o'quv yili|ta'til|tatil|jadval)\b/;
const OFFICIAL = /\b(qaror|buyruq|farmon|qonun|nizom|qoida|qoidalar|tartib|me'yoriy|vazirlik|dtm|attestatsiya|sertifikat|toifa|ish haqi|maosh|oylik|stipendiya|qabul|imtihon|ta'til|tatil)\b/;
const EXPLICIT = /\b(internetdan|internetda|internet|saytdan|havola|havolasi|manba|manbalar|link|google|qidirib)\b/;
const MATERIAL = /\b(test|testlar|testlari|namuna|namunasi|tayyor|nazorat|mashq|mashqlar|topshiriq|topshiriqlar|ishlanma|ishlanmalari|taqvim|tematik|chorak)\b/;
const CREATE = /(tuzib ber|yozib ber|yarat|tayyorlab ber|ishlab chiq|generatsiya|tuzing|tuz\b)/;

export function schoolYearOf(now = new Date()): string {
  const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function analyzeQuery(question: string, now = new Date()): Intent {
  const q = norm(question).replace(/\s+/g, " ").trim();
  const g = q.match(/\b(\d{1,2})\s*-?\s*sinf/);
  const grade = g && Number(g[1]) >= 1 && Number(g[1]) <= 11 ? Number(g[1]) : undefined;
  const cq = q.match(/\b([1-4])\s*-?\s*chorak/);
  const wq = q.match(/\b(birinchi|ikkinchi|uchinchi|to'rtinchi)\s+chorak/);
  const quarter = cq ? Number(cq[1]) : wq ? WORD_QUARTER[wq[1]] : undefined;
  const y = q.match(/\b(20[2-3]\d)\b/);
  const year = y ? Number(y[1]) : undefined;
  const subject = SUBJECTS.find(([, re]) => re.test(q))?.[0];
  const explicit = EXPLICIT.test(q);
  const creating = CREATE.test(q) && !explicit;
  const wantsMaterial = !creating && MATERIAL.test(q) && (!!grade || !!subject || !!quarter);
  const needsFresh = !creating && (FRESH.test(q) || (year !== undefined && year >= now.getUTCFullYear() - 1));
  return { needsFresh, wantsMaterial, officialLike: OFFICIAL.test(q), explicit, spec: { grade, quarter, year, subject, schoolYear: year ? `${year - 1}-${year}` : schoolYearOf(now) } };
}

/** Avtomatik qidirish kerakmi (aniq so'ralgan yoki yangi/rasmiy ma'lumot yoki tayyor material). */
export const needsWeb = (i: Intent) => i.explicit || i.needsFresh || i.wantsMaterial;

/** Qidiruv so'rovi: tayyor material izlanganda fan, sinf, chorak va yil bilan aniqlashtiriladi; aks holda savolning o'zi. */
export function refineQuery(question: string, i: Intent): string {
  const clean = question.replace(/\s+/g, " ").trim();
  if (!i.wantsMaterial) return clean.slice(0, 380);
  const { grade, quarter, subject, schoolYear, year } = i.spec;
  const parts = [grade ? `${grade}-sinf` : "", subject ?? "", quarter ? `${quarter}-chorak` : "", "test namuna", year ? String(year) : schoolYear, "O'zbekiston"];
  return parts.filter(Boolean).join(" ").slice(0, 380);
}
