import { addChecklist, addPlanItem, deleteChecklist, deletePlanItem, generatePlan, patchChecklist, patchPlanItem, seedChecklist, toifaState } from "../../toifa";
import { addDays, uzToday } from "../../planlogic";
import { checklistInput, planItemInput } from "../../toifavalid";
import { clip, dayLabel, esc, fmtDate, fmtWhen, parseDate, safeUrl } from "../botlogic";
import type { Ctx } from "../ctx";
import { EXAM_LABEL, saveProfile } from "../profile";
import { b, link, type Btn } from "../tg";
import { heading, nav } from "../ui";

/** TOIFA NAVIGATOR botda: maqsad, reja (bosib belgilanadi), cheklist, kalendar va rasmiy ma'lumotlar. */
type State = Awaited<ReturnType<typeof toifaState>>;

const goalLine = (g: State["goal"]) => {
  if (!g.targetExam) return "🎯 Maqsad hali qo'yilmagan.";
  const exam = EXAM_LABEL[g.targetExam as keyof typeof EXAM_LABEL] ?? g.targetExam;
  return `🎯 Maqsad: <b>${esc(exam)}</b>${g.examDate ? `, ${fmtDate(g.examDate)}` : ""}${g.daysLeft !== null ? ` (<b>${g.daysLeft}</b> kun qoldi)` : ""}${g.dailyMinutes ? `\n⏱ Kuniga ${g.dailyMinutes} daqiqa` : ""}`;
};

export async function entry(ctx: Ctx) {
  await ctx.idle();
  const s = await toifaState(ctx.userId);
  const today = s.plan.filter((p) => p.date === s.today);
  const lines = [heading("🧭", "TOIFA reja"), goalLine(s.goal), ""];
  lines.push(today.length ? `📅 Bugungi reja: ${today.filter((p) => p.done).length}/${today.length} bajarildi` : "📅 Bugunga reja yo'q.");
  const steps = s.roadmap.slice(0, 6);
  if (steps.length) lines.push("", "<b>Tayyorgarlik bosqichlari</b>", ...steps.map((x) => `${x.done ? "✅" : "⬜"} ${esc(x.title)}`));
  const kb: Btn[][] = [
    [b("📋 Reja (7 kun)", "p.pl"), b("➕ Band qo'shish", "p.add")],
    [b("🔄 Rejani avto tuzish", "p.gen"), b("✅ Hujjatlar cheklisti", "p.ck")],
    [b("📅 Kalendar", "p.cal"), b("🏛 Rasmiy ma'lumotlar", "p.of")],
    [b("🎯 Maqsadni o'zgartirish", "p.goal")], nav(),
  ];
  await ctx.show({ text: lines.join("\n"), kb });
}

async function planList(ctx: Ctx) {
  const s = await toifaState(ctx.userId);
  const end = addDays(s.today, 6);
  const items = s.plan.filter((p) => p.date >= s.today && p.date <= end);
  const lines = [heading("📋", "Reja: yaqin 7 kun"), "Bandni bosing: bajarilgan deb belgilanadi (yana bosilsa, belgi olinadi).", ""];
  if (!items.length) lines.push("Bu hafta uchun reja yo'q. «🔄 Rejani avto tuzish» yoki «➕ Band qo'shish» ni bosing.");
  let last = "";
  for (const p of items.slice(0, 25)) {
    if (p.date !== last) { lines.push(`\n<b>${p.date === s.today ? "Bugun" : p.date === addDays(s.today, 1) ? "Ertaga" : dayLabel(p.date)}</b>`); last = p.date; }
    lines.push(`${p.done ? "✅" : "⬜"} ${esc(clip(p.title, 90))}`);
  }
  const kb: Btn[][] = items.slice(0, 10).map((p) => [b(`${p.done ? "✅" : "⬜"} ${p.date.slice(8)}.${p.date.slice(5, 7)} ${clip(p.title, 30)}`, `p.t.${p.id}.${p.done ? 0 : 1}`)]);
  kb.push([b("➕ Qo'shish", "p.add"), b("🗑 O'chirish", "p.dl")], nav("p"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function deleteList(ctx: Ctx) {
  const s = await toifaState(ctx.userId);
  const items = s.plan.filter((p) => p.date >= s.today).slice(0, 12);
  if (!items.length) return ctx.show({ text: `${heading("🗑", "Reja bandini o'chirish")}\nO'chiriladigan band yo'q.`, kb: [nav("p.pl")] });
  await ctx.show({ text: `${heading("🗑", "Reja bandini o'chirish")}\nO'chirmoqchi bo'lgan bandni bosing:`, kb: [...items.map((p) => [b(`🗑 ${p.date.slice(8)}.${p.date.slice(5, 7)} ${clip(p.title, 34)}`, `p.dx.${p.id}`)]), nav("p.pl")] });
}

async function checklist(ctx: Ctx) {
  const s = await toifaState(ctx.userId);
  const done = s.checklist.filter((c) => c.done).length;
  const lines = [heading("✅", "Hujjatlar cheklisti"), s.checklist.length ? `Tayyor: ${done}/${s.checklist.length}. Bandni bosing: belgi qo'yiladi.` : "Cheklist bo'sh. Tayyor tavsiya ro'yxatini qo'shing yoki o'zingiz yozing.", ""];
  if (s.checklist.length) lines.push("<i>Bu umumiy tavsiya: rasmiy ro'yxat uchun «🏛 Rasmiy ma'lumotlar» ga qarang.</i>");
  const kb: Btn[][] = s.checklist.slice(0, 14).map((c) => [b(`${c.done ? "✅" : "⬜"} ${clip(c.label, 40)}`, `p.ct.${c.id}.${c.done ? 0 : 1}`)]);
  kb.push([b("➕ Band qo'shish", "p.cadd"), ...(s.checklist.length ? [b("🗑 O'chirish", "p.cdel")] : [b("📥 Tayyor ro'yxat", "p.cseed")])], nav("p"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function checklistDelete(ctx: Ctx) {
  const s = await toifaState(ctx.userId);
  if (!s.checklist.length) return checklist(ctx);
  await ctx.show({ text: `${heading("🗑", "Cheklist bandini o'chirish")}\nO'chirmoqchi bo'lgan bandni bosing:`, kb: [...s.checklist.slice(0, 14).map((c) => [b(`🗑 ${clip(c.label, 44)}`, `p.cx.${c.id}`)]), nav("p.ck")] });
}

async function calendar(ctx: Ctx) {
  const s = await toifaState(ctx.userId);
  const end = addDays(s.today, 21);
  type Row = { date: string; text: string };
  const rows: Row[] = [
    ...s.plan.filter((p) => p.date >= s.today && p.date <= end).map((p) => ({ date: p.date, text: `${p.done ? "✅" : "📌"} ${esc(clip(p.title, 70))}` })),
    ...s.seminars.filter((x) => x.startsAt.slice(0, 10) >= s.today && x.startsAt.slice(0, 10) <= end).map((x) => ({ date: x.startsAt.slice(0, 10), text: `📅 Seminar: ${esc(clip(x.title, 60))}, ${fmtWhen(x.startsAt).split(", ").pop()}` })),
    ...s.official.filter((o) => o.date && o.date >= s.today && o.date <= end).map((o) => ({ date: o.date!, text: `🏛 ${esc(clip(o.title, 70))}${o.verified ? "" : " (tekshirilmagan)"}` })),
  ].sort((a, c) => a.date.localeCompare(c.date));
  const lines = [heading("📅", "Kalendar: yaqin 3 hafta"), ""];
  if (!rows.length) lines.push("Yaqin 3 haftada reja, seminar yoki rasmiy sana yo'q.");
  let last = "";
  for (const r of rows.slice(0, 30)) { if (r.date !== last) { lines.push(`\n<b>${dayLabel(r.date)}</b>`); last = r.date; } lines.push(r.text); }
  await ctx.show({ text: lines.join("\n"), kb: [nav("p")] });
}

async function official(ctx: Ctx) {
  const s = await toifaState(ctx.userId);
  const lines = [heading("🏛", "Rasmiy ma'lumotlar"), "Ma'lumotni administrator manba bilan kiritadi. ✅ belgisi: tekshirilgan.", ""];
  if (!s.official.length) lines.push("Hozircha rasmiy ma'lumot kiritilmagan.");
  for (const o of s.official.slice(0, 10)) lines.push(`${o.verified ? "✅" : "⚠️"} <b>${esc(clip(o.title, 80))}</b>${o.date ? `, ${fmtDate(o.date)}` : ""}${o.note ? `\n   ${esc(clip(o.note, 160))}` : ""}${o.verified ? "" : "\n   <i>Tekshirilmagan: rasmiy manbadan tasdiqlang.</i>"}`);
  const kb: Btn[][] = s.official.filter((o) => safeUrl(o.url)).slice(0, 6).map((o) => [link(`🔗 ${clip(o.title, 40)}`, safeUrl(o.url)!)]);
  kb.push(nav("p"));
  await ctx.show({ text: lines.join("\n"), kb });
}

function goalScreen(ctx: Ctx) {
  return ctx.show({
    text: `${heading("🎯", "Imtihon maqsadi")}\nQaysi imtihonga tayyorlanyapsiz? Maqsad rejani to'g'ri tuzish uchun kerak.`,
    kb: [[b("Attestatsiya", "p.ge.A")], [b("Milliy sertifikat", "p.ge.M")], [b("Hozircha imtihon yo'q", "p.ge.N")], nav("p")],
  });
}

const DAILY = [30, 45, 60, 90, 120];

export async function onCb(ctx: Ctx, a: string[]) {
  const [act, x, y] = a;
  switch (act) {
    case "pl": return planList(ctx);
    case "t": if (x) { await patchPlanItem(ctx.userId, x, { done: y === "1" }); await ctx.toast(y === "1" ? "Bajarildi ✅" : "Belgi olib tashlandi"); } return planList(ctx);
    case "add":
      await ctx.mode("p.title");
      return ctx.show({ text: `${heading("➕", "Yangi reja bandi")}\nBand nomini yozing. Masalan: «Pedagogika bo'yicha 20 ta test».`, kb: [[b("Bekor qilish", "p.pl")]] });
    case "ad": {
      const title = String(ctx.state.data.title ?? "");
      if (!title) return planList(ctx);
      const date = addDays(uzToday(), Number(x) || 0);
      await addPlanItem(ctx.userId, planItemInput.parse({ date, title, kind: "TASK" }));
      await ctx.idle(); await ctx.toast("Qo'shildi ✅");
      return planList(ctx);
    }
    case "dl": return deleteList(ctx);
    case "dx": if (x) { await deletePlanItem(ctx.userId, x); await ctx.toast("O'chirildi"); } return deleteList(ctx);
    case "gen": {
      const r = await generatePlan(ctx.userId);
      await ctx.toast(r.created ? `${r.created} ta band tuzildi` : "Reja uchun ma'lumot yetarli emas", !r.created);
      return planList(ctx);
    }
    case "ck": return checklist(ctx);
    case "ct": if (x) { await patchChecklist(ctx.userId, x, { done: y === "1" }); await ctx.toast(y === "1" ? "Tayyor ✅" : "Belgi olib tashlandi"); } return checklist(ctx);
    case "cadd":
      await ctx.mode("p.cadd");
      return ctx.show({ text: `${heading("➕", "Yangi cheklist bandi")}\nHujjat yoki ish nomini yozing. Masalan: «Diplom nusxasi».`, kb: [[b("Bekor qilish", "p.ck")]] });
    case "cseed": await seedChecklist(ctx.userId); await ctx.toast("Ro'yxat qo'shildi"); return checklist(ctx);
    case "cdel": return checklistDelete(ctx);
    case "cx": if (x) { await deleteChecklist(ctx.userId, x); await ctx.toast("O'chirildi"); } return checklistDelete(ctx);
    case "cal": return calendar(ctx);
    case "of": return official(ctx);
    case "goal": return goalScreen(ctx);
    case "ge": {
      if (x === "N") { await saveProfile(ctx.userId, { targetExam: null, examDate: null }); await ctx.toast("Saqlandi"); return entry(ctx); }
      await saveProfile(ctx.userId, { targetExam: x === "M" ? "MILLIY_SERTIFIKAT" : "ATTESTATSIYA" });
      await ctx.mode("p.gdate");
      return ctx.show({ text: `${heading("📆", "Imtihon sanasi")}\nSanani yozing. Masalan: <b>15.03.2027</b>. Bilmasangiz, o'tkazib yuboring.`, kb: [[b("O'tkazib yuborish", "p.gs")]] });
    }
    case "gs": await ctx.idle(); return minutesScreen(ctx);
    case "gm": {
      await saveProfile(ctx.userId, { dailyMinutes: DAILY.includes(Number(x)) ? Number(x) : 60 });
      await ctx.toast("Maqsad saqlandi ✅");
      return ctx.show({ text: `${heading("🎯", "Maqsad saqlandi")}\nEndi shu maqsad bo'yicha rejani tuzishingiz mumkin.`, kb: [[b("🔄 Rejani avto tuzish", "p.gen")], nav("p")] });
    }
    default: return entry(ctx);
  }
}

function minutesScreen(ctx: Ctx) {
  return ctx.show({ text: `${heading("⏱", "Kuniga qancha vaqt ajrata olasiz?")}`, kb: [DAILY.slice(0, 3).map((m) => b(`${m} daq`, `p.gm.${m}`)), DAILY.slice(3).map((m) => b(`${m} daq`, `p.gm.${m}`)), nav("p")] });
}

/** Matn kutilayotgan holatlar. true: xabar shu bo'limga tegishli edi. */
export async function onText(ctx: Ctx, mode: string, text: string): Promise<boolean> {
  if (mode === "p.title") {
    const title = planItemInput.shape.title.parse(text);
    await ctx.mode("p.date", { title });
    await ctx.say({ text: `📌 <b>${esc(clip(title, 120))}</b>\n\nQaysi kunga qo'shamiz? Tugmani bosing yoki sanani yozing (masalan 15.03.2027).`, kb: [[b("Bugun", "p.ad.0"), b("Ertaga", "p.ad.1"), b("Indinga", "p.ad.2")], [b("Bekor qilish", "p.pl")]] });
    return true;
  }
  if (mode === "p.date") {
    const date = parseDate(text, uzToday());
    if (!date) { await ctx.say("Sana tushunarsiz. Masalan: <b>15.03.2027</b>, «ertaga» yoki tugmani bosing."); return true; }
    const title = String(ctx.state.data.title ?? "");
    await addPlanItem(ctx.userId, planItemInput.parse({ date, title, kind: "TASK" }));
    await ctx.idle();
    await ctx.say({ text: `✅ Qo'shildi: <b>${esc(clip(title, 100))}</b>, ${fmtDate(date)}`, kb: [[b("📋 Rejani ko'rish", "p.pl")], nav("p")] });
    return true;
  }
  if (mode === "p.cadd") {
    await addChecklist(ctx.userId, checklistInput.parse({ label: text }));
    await ctx.idle();
    await ctx.say({ text: "✅ Cheklistga qo'shildi.", kb: [[b("✅ Cheklistni ko'rish", "p.ck")], nav("p")] });
    return true;
  }
  if (mode === "p.gdate") {
    const date = parseDate(text, uzToday());
    if (!date || date < uzToday()) { await ctx.say("Sana tushunarsiz yoki o'tib ketgan. Masalan: <b>15.03.2027</b>."); return true; }
    await saveProfile(ctx.userId, { examDate: date });
    await ctx.idle();
    await ctx.say({ text: `${heading("⏱", "Kuniga qancha vaqt ajrata olasiz?")}`, kb: [DAILY.slice(0, 3).map((m) => b(`${m} daq`, `p.gm.${m}`)), DAILY.slice(3).map((m) => b(`${m} daq`, `p.gm.${m}`))] });
    return true;
  }
  return false;
}
