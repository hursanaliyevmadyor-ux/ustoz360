import { generateLesson, generateTasks, lessonInput } from "../../ai/generate";
import { deleteDoc, getDoc, listDocs, saveDoc } from "../../docs";
import { DOC_LABEL, docInput, type DocKind, type TaskItem } from "../../docsvalid";
import { LESSON_SECTIONS } from "../../ai/gateway";
import { clip, esc, fmtDate, splitText } from "../botlogic";
import type { Ctx } from "../ctx";
import { b, link, typing, type Btn } from "../tg";
import { heading, nav } from "../ui";

/** DARSYOR botda: AI bilan dars ishlanmasi va topshiriqlar qoralamasi (o'qituvchi tekshiradi), saqlangan hujjatlarni ko'rish. */
const GRADES = Array.from({ length: 11 }, (_, i) => i + 1);
const LEVELS = { easy: "Oson", medium: "O'rta", hard: "Murakkab" } as const;
const AI_NOTE = "<i>AI qoralamasi: ishlatishdan oldin o'zingiz tekshiring.</i>";

export async function entry(ctx: Ctx) {
  await ctx.idle();
  await ctx.show({
    text: `${heading("📝", "DARSYOR")}\nAI yordamida dars ishlanmasi va test topshiriqlari tuzing. Natija qoralama bo'ladi, hujjatlaringizga saqlanadi.`,
    kb: [[b("📘 Dars ishlanmasi", "d.l")], [b("✅ Test topshiriqlari", "d.t")], [b("🗂 Hujjatlarim", "d.docs.0")],
      [link("🎨 Ko'rgazma, rubrika, kuzatuv (saytda)", `${ctx.origin}/darsyor/materiallar`)], nav()],
  });
}

const gradeRows = (prefix: string): Btn[][] => [GRADES.slice(0, 4), GRADES.slice(4, 8), GRADES.slice(8)].map((r) => r.map((g) => b(`${g}-sinf`, `${prefix}.${g}`)));

// ---------- Dars ishlanmasi ----------
async function lessonStart(ctx: Ctx) {
  await ctx.mode("d.l1");
  await ctx.show({ text: `${heading("📘", "Dars ishlanmasi")}\n1/4. Fan nomini yozing. Masalan: <b>Matematika</b>.`, kb: [[b("Bekor qilish", "d")]] });
}

async function lessonGenerate(ctx: Ctx, duration: number) {
  const d = ctx.state.data as { subject?: string; grade?: number; topic?: string };
  if (!d.subject || !d.grade || !d.topic) return entry(ctx);
  const input = lessonInput.parse({ subject: d.subject, grade: d.grade, topic: d.topic, duration });
  await ctx.idle();
  await ctx.toast("Tayyorlanmoqda…");
  await ctx.say(`⏳ Dars ishlanmasi tayyorlanmoqda: <b>${esc(clip(input.topic, 80))}</b>, ${input.grade}-sinf, ${input.duration} daqiqa.\nBu 20–40 soniya olishi mumkin.`);
  await typing(ctx.chatId);
  const r = await generateLesson(ctx.userId, input);
  const text = LESSON_SECTIONS.filter((t) => r.sections[t]?.trim()).map((t) => `${t.toUpperCase()}\n${r.sections[t].trim()}`).join("\n\n");
  await saveDoc(ctx.userId, docInput.parse({ kind: "lesson_plan", title: `${input.topic}, ${input.grade}-sinf`, subject: input.subject, grade: String(input.grade), status: "DRAFT", data: { params: { subject: input.subject, grade: String(input.grade), topic: input.topic, duration: input.duration }, sections: r.sections, ai: true } }));
  for (const part of splitText(text)) await ctx.plain(part);
  await ctx.say({ text: `✅ Tayyor va hujjatlaringizga saqlandi (qoralama).\n${AI_NOTE}`, kb: [[b("🔄 Boshqa dars", "d.l"), b("🗂 Hujjatlarim", "d.docs.0")], [link("Saytda tahrirlash", `${ctx.origin}/darsyor/dars-ishlanmasi`)], nav("d")] });
}

// ---------- Test topshiriqlari ----------
async function tasksStart(ctx: Ctx) {
  await ctx.mode("d.t1");
  await ctx.show({ text: `${heading("✅", "Test topshiriqlari")}\n1/5. Fan nomini yozing. Masalan: <b>Ona tili</b>.`, kb: [[b("Bekor qilish", "d")]] });
}

const taskText = (t: TaskItem, i: number) => {
  const lines = [`${i + 1}) ${t.text}`];
  if (t.options.length) lines.push(...t.options.map((o, k) => (t.type === "order" ? `   ${k + 1}. ${o}` : `   ${String.fromCharCode(65 + k)}) ${o}`)));
  if (t.pairs.length) lines.push(...t.pairs.map((p) => `   ${p.l} — ${p.r}`));
  if (t.correct.length && (t.type === "single" || t.type === "multi")) lines.push(`   ✔ To'g'ri: ${t.correct.map((c) => String.fromCharCode(65 + c)).join(", ")}`);
  if (t.answer) lines.push(`   ✔ Javob: ${t.answer}`);
  if (t.explanation) lines.push(`   💡 ${t.explanation}`);
  return lines.join("\n");
};

async function tasksGenerate(ctx: Ctx, mixed: boolean) {
  const d = ctx.state.data as { subject?: string; grade?: string; topic?: string; level?: "easy" | "medium" | "hard"; count?: number };
  if (!d.subject || !d.grade || !d.topic || !d.level || !d.count) return entry(ctx);
  await ctx.idle();
  await ctx.toast("Tayyorlanmoqda…");
  await ctx.say(`⏳ ${d.count} ta topshiriq tayyorlanmoqda: <b>${esc(clip(d.topic, 80))}</b>, ${esc(d.grade)}-sinf.\nBu 20–40 soniya olishi mumkin.`);
  await typing(ctx.chatId);
  const r = await generateTasks(ctx.userId, { subject: d.subject, grade: d.grade, topic: d.topic, level: d.level, count: d.count, types: mixed ? ["single", "open", "situation"] : ["single"] });
  if (!r.items.length) { await ctx.say({ text: r.note ?? "AI topshiriq qaytarmadi.", kb: [[b("🔄 Qayta urinish", "d.t")], nav("d")] }); return; }
  await saveDoc(ctx.userId, docInput.parse({ kind: "taskset", title: `${d.topic}: topshiriqlar`, subject: d.subject, grade: d.grade, status: "DRAFT", data: { params: { subject: d.subject, grade: d.grade, topic: d.topic, level: d.level }, items: r.items } }));
  for (const part of splitText(r.items.map(taskText).join("\n\n"))) await ctx.plain(part);
  await ctx.say({ text: `✅ ${r.items.length} ta topshiriq tayyor va hujjatlaringizga saqlandi (qoralama).${r.note ? `\n⚠️ ${esc(r.note)}` : ""}\n${AI_NOTE}`, kb: [[b("🔄 Yana", "d.t"), b("🗂 Hujjatlarim", "d.docs.0")], [link("Saytda tasdiqlash", `${ctx.origin}/darsyor/test-generator`)], nav("d")] });
}

// ---------- Hujjatlar ----------
const PAGE = 6;

async function docs(ctx: Ctx, page: number) {
  const { docs: all } = await listDocs(ctx.userId, { limit: 100 });
  const pages = Math.max(1, Math.ceil(all.length / PAGE)), p = Math.min(Math.max(0, page), pages - 1);
  const lines = [heading("🗂", "Hujjatlarim"), all.length ? `Jami: ${all.length} ta. Ochish uchun bosing.` : "Hali saqlangan hujjat yo'q. Dars ishlanmasi yoki topshiriq tuzing."];
  const kb: Btn[][] = all.slice(p * PAGE, p * PAGE + PAGE).map((x) => [b(`${x.kind === "lesson_plan" ? "📘" : x.kind === "taskset" ? "✅" : "🎨"} ${clip(x.title, 34)}`, `d.o.${x.id}`)]);
  if (pages > 1) kb.push([...(p > 0 ? [b("◀️", `d.docs.${p - 1}`)] : []), b(`${p + 1}/${pages}`, "x"), ...(p < pages - 1 ? [b("▶️", `d.docs.${p + 1}`)] : [])]);
  kb.push(nav("d"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function openDoc(ctx: Ctx, id: string) {
  const d = await getDoc(ctx.userId, id);
  const kind = d.kind as DocKind;
  const data = d.data as { sections?: Record<string, string>; items?: TaskItem[] } | null;
  const head = `${heading("🗂", d.title)}\n${DOC_LABEL[kind] ?? kind}${d.subject ? ` · ${esc(d.subject)}` : ""}${d.grade ? ` · ${esc(d.grade)}-sinf` : ""} · ${fmtDate(d.updatedAt)}${d.status === "DRAFT" ? " · qoralama" : ""}`;
  let body = "";
  if (kind === "lesson_plan" && data?.sections) body = LESSON_SECTIONS.filter((t) => data.sections![t]?.trim()).map((t) => `${t.toUpperCase()}\n${data.sections![t].trim()}`).join("\n\n");
  else if (kind === "taskset" && data?.items) body = data.items.map(taskText).join("\n\n");
  await ctx.say(head);
  if (body) for (const part of splitText(body)) await ctx.plain(part);
  else await ctx.plain("Bu hujjat turini saytda ko'ring va tahrirlang.");
  await ctx.say({ text: "Hujjat bilan nima qilamiz?", kb: [[link("Saytda ochish", `${ctx.origin}/darsyor/${kind === "taskset" ? "test-generator" : kind === "lesson_plan" ? "dars-ishlanmasi" : "materiallar"}`)], [b("🗑 O'chirish", `d.del.${id}`)], nav("d.docs.0")] });
}

export async function onCb(ctx: Ctx, a: string[]) {
  const [act, x] = a;
  switch (act) {
    case "l": return lessonStart(ctx);
    case "lg": { const g = Number(x); if (!g) return entry(ctx); await ctx.mode("d.l3", { ...ctx.state.data, grade: g }); return ctx.show({ text: `${heading("📘", "Dars ishlanmasi")}\n3/4. Dars mavzusini yozing. Masalan: <b>Oddiy kasrlarni qo'shish</b>.`, kb: [[b("Bekor qilish", "d")]] }); }
    case "ld": return lessonGenerate(ctx, Number(x) || 45);
    case "t": return tasksStart(ctx);
    case "tg": { await ctx.mode("d.t3", { ...ctx.state.data, grade: x }); return ctx.show({ text: `${heading("✅", "Test topshiriqlari")}\n3/5. Mavzuni yozing. Masalan: <b>Ega va kesim</b>.`, kb: [[b("Bekor qilish", "d")]] }); }
    case "tl": { if (!(x in LEVELS)) return entry(ctx); await ctx.mode("d.t5", { ...ctx.state.data, level: x }); return ctx.show({ text: `${heading("✅", "Test topshiriqlari")}\n5/5. Nechta topshiriq kerak?`, kb: [[5, 10, 15].map((n) => b(String(n), `d.tc.${n}`))] }); }
    case "tc": { const n = Number(x); if (![5, 10, 15].includes(n)) return entry(ctx); await ctx.mode("d.t6", { ...ctx.state.data, count: n }); return ctx.show({ text: `${heading("✅", "Topshiriq turlari")}\nQaysi turda tuzaylik?`, kb: [[b("Faqat test (bir javobli)", "d.ty.0")], [b("Aralash: test, ochiq va vaziyatli", "d.ty.1")]] }); }
    case "ty": return tasksGenerate(ctx, x === "1");
    case "docs": return docs(ctx, Number(x) || 0);
    case "o": return x ? openDoc(ctx, x) : docs(ctx, 0);
    case "del": return ctx.show({ text: `${heading("🗑", "Hujjatni o'chirish")}\nBu hujjat butunlay o'chadi. Davom etamizmi?`, kb: [[b("Ha, o'chirish", `d.dy.${x}`), b("Yo'q", "d.docs.0")]] });
    case "dy": await deleteDoc(ctx.userId, x); await ctx.toast("O'chirildi"); return docs(ctx, 0);
    default: return entry(ctx);
  }
}

export async function onText(ctx: Ctx, mode: string, text: string): Promise<boolean> {
  const d = ctx.state.data;
  if (mode === "d.l1") {
    const subject = lessonInput.shape.subject.parse(text);
    await ctx.mode("d.l2", { subject });
    await ctx.say({ text: `Fan: <b>${esc(subject)}</b>\n2/4. Nechanchi sinf?`, kb: [...gradeRows("d.lg"), [b("Bekor qilish", "d")]] });
    return true;
  }
  if (mode === "d.l3") {
    const topic = lessonInput.shape.topic.parse(text);
    await ctx.mode("d.l4", { ...d, topic });
    await ctx.say({ text: `Mavzu: <b>${esc(topic)}</b>\n4/4. Dars necha daqiqa? Tugmani bosing yoki raqam yozing.`, kb: [[40, 45, 60, 80].map((n) => b(`${n} daq`, `d.ld.${n}`))] });
    return true;
  }
  if (mode === "d.l4") {
    const n = Number(text.replace(/\D/g, ""));
    if (!n || n < 10 || n > 120) { await ctx.say("Davomiylikni daqiqada yozing (10 dan 120 gacha). Masalan: <b>45</b>."); return true; }
    await lessonGenerate(ctx, n);
    return true;
  }
  if (mode === "d.t1") {
    const subject = text.trim().slice(0, 80);
    if (!subject) return true;
    await ctx.mode("d.t2", { subject });
    await ctx.say({ text: `Fan: <b>${esc(subject)}</b>\n2/5. Nechanchi sinf?`, kb: [...gradeRows("d.tg"), [b("Bekor qilish", "d")]] });
    return true;
  }
  if (mode === "d.t3") {
    const topic = text.trim().slice(0, 200);
    if (topic.length < 2) { await ctx.say("Mavzu nomini yozing (kamida 2 belgi)."); return true; }
    await ctx.mode("d.t4", { ...d, topic });
    await ctx.say({ text: `Mavzu: <b>${esc(topic)}</b>\n4/5. Qiyinlik darajasi?`, kb: [(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((k) => b(LEVELS[k], `d.tl.${k}`))] });
    return true;
  }
  if (["d.l2", "d.t2", "d.t4", "d.t5", "d.t6"].includes(mode)) { await ctx.say("Yuqoridagi tugmalardan birini tanlang."); return true; }
  return false;
}
