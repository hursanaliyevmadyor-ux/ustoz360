import { addStudents, classDetail, createClass, deleteClass, listClasses, removeStudent, saveAssessment, saveScores } from "../../sinf";
import { uzToday } from "../../planlogic";
import { aliasesInput, assessmentInput, classInput, scoresInput } from "../../sinfvalid";
import { MIN_SCORES } from "../../sinflogic";
import { bar, clip, esc, fmtDate, parseScores, splitAliases } from "../botlogic";
import type { Ctx } from "../ctx";
import { b, type Btn } from "../tg";
import { heading, nav } from "../ui";

/** SINF ANALITIKA botda: sinf va taxallusli o'quvchilar, baholash, ball kiritish (matn bilan) va tahlil. O'quvchi ismi saqlanmaydi. */
const KIND_LABEL = { BEFORE: "Boshlang'ich (oldin)", AFTER: "Yakuniy (keyin)", CURRENT: "Joriy" } as const;
const KIND_CODE: Record<string, keyof typeof KIND_LABEL> = { B: "BEFORE", A: "AFTER", C: "CURRENT" };

export async function entry(ctx: Ctx) {
  await ctx.idle();
  const { classes } = await listClasses(ctx.userId);
  const lines = [heading("👩‍🏫", "Sinflarim"), classes.length ? "Sinfni tanlang:" : "Hali sinf yo'q. «➕ Yangi sinf» bilan boshlang.", "", "<i>O'quvchilar ism-familiyasi emas, qisqa taxallus bilan yoziladi (masalan: O-1, Oybek).</i>"];
  const kb: Btn[][] = classes.map((c) => [b(`${clip(c.name, 18)} · ${clip(c.subject, 16)} (${c.students})${c.avg !== null ? ` ${c.avg}%` : ""}`, `s.c.${c.id}`)]);
  kb.push([b("➕ Yangi sinf", "s.new")], nav());
  await ctx.show({ text: lines.join("\n"), kb });
}

async function classScreen(ctx: Ctx, id: string) {
  await ctx.idle();
  const c = await classDetail(ctx.userId, id);
  const lines = [heading("👩‍🏫", `${c.name} · ${c.subject}`), c.grade ? `Sinf: ${esc(c.grade)}` : "", `👥 O'quvchilar: <b>${c.students.length}</b>   📝 Baholashlar: <b>${c.assessments.length}</b>`].filter(Boolean);
  if (c.analysis.classAvg !== null) lines.push(`📈 Sinf o'rtachasi: <b>${c.analysis.classAvg}%</b>  ${bar(c.analysis.classAvg)}`);
  const last = c.assessments.slice(-3).reverse();
  if (last.length) lines.push("", "<b>Oxirgi baholashlar</b>", ...last.map((a) => `• ${fmtDate(a.date)} ${esc(clip(a.title, 40))} (${esc(clip(a.topic, 30))})`));
  if (!c.students.length) lines.push("", "Avval o'quvchilarni qo'shing (👥).");
  await ctx.show({
    text: lines.join("\n"),
    kb: [[b("👥 O'quvchilar", `s.st.${id}`), b("📝 Baholash qo'shish", `s.as.${id}`)], [b("🔢 Ball kiritish", `s.sc.${id}`), b("📊 Tahlil", `s.an.${id}`)], [b("🗑 Sinfni o'chirish", `s.del.${id}`)], nav("s")],
  });
}

async function studentsScreen(ctx: Ctx, id: string) {
  await ctx.idle();
  const c = await classDetail(ctx.userId, id);
  const lines = [heading("👥", `${c.name}: o'quvchilar`), c.students.length ? c.students.map((s, i) => `${i + 1}. ${esc(s.alias)}`).join("\n") : "O'quvchi hali yo'q.", "", "<i>Taxallus: ism-familiya emas, telefon yoki email emas.</i>"];
  await ctx.show({ text: lines.join("\n"), kb: [[b("➕ Qo'shish", `s.sa.${id}`), ...(c.students.length ? [b("🗑 O'chirish", `s.sd.${id}`)] : [])], nav(`s.c.${id}`)] });
}

async function analysis(ctx: Ctx, id: string) {
  const c = await classDetail(ctx.userId, id);
  const a = c.analysis;
  const lines = [heading("📊", `${c.name}: tahlil`)];
  if (a.classAvg === null) lines.push("", "Hali ball kiritilmagan. «🔢 Ball kiritish» dan boshlang.");
  else {
    lines.push("", `📈 Sinf o'rtachasi: <b>${a.classAvg}%</b>`);
    if (a.trend.length) lines.push("", "<b>Baholashlar bo'yicha</b>", ...a.trend.slice(-5).map((t) => `• ${esc(clip(t.title, 34))}: ${t.avg === null ? "—" : `${t.avg}%`} (${t.n} ta natija)`));
    const topics = a.topics.filter((t) => t.avg !== null).slice(0, 5);
    if (topics.length) lines.push("", "<b>Mavzular</b> (qiyindan boshlab)", ...topics.map((t) => `${t.level === "weak" ? "⚠️" : t.level === "strong" ? "🟢" : "🟡"} ${esc(clip(t.topic, 34))}: ${t.avg}%${t.lowData ? ` <i>(natija kam, ${MIN_SCORES} tadan kam)</i>` : ""}`));
    const help = a.students.filter((s) => s.needsHelp).slice(0, 5);
    if (help.length) lines.push("", "<b>Yordam kerak bo'lishi mumkin</b>", ...help.map((s) => `• ${esc(s.alias)}: ${s.avg}%`));
    if (c.insights.length) lines.push("", "💡 <b>Xulosa</b>", ...c.insights.slice(0, 4).map((i) => `• ${esc(i)}`));
  }
  await ctx.show({ text: lines.join("\n"), kb: [nav(`s.c.${id}`)] });
}

async function scoreAssessments(ctx: Ctx, id: string) {
  const c = await classDetail(ctx.userId, id);
  if (!c.students.length) return ctx.toast("Avval o'quvchilarni qo'shing.", true);
  if (!c.assessments.length) return ctx.toast("Avval baholash qo'shing (📝).", true);
  await ctx.show({
    text: `${heading("🔢", "Ball kiritish")}\nQaysi baholash uchun?`,
    kb: [...c.assessments.slice(-8).reverse().map((a) => [b(`${fmtDate(a.date)} ${clip(a.title, 30)} (/${a.maxScore})`, `s.sq.${id}.${a.id}`)]), nav(`s.c.${id}`)],
  });
}

async function scoreInput(ctx: Ctx, cid: string, aid: string) {
  const c = await classDetail(ctx.userId, cid);
  const a = c.assessments.find((x) => x.id === aid);
  if (!a) return scoreAssessments(ctx, cid);
  const have = new Map(c.scores.filter((s) => s.assessmentId === aid).map((s) => [s.studentId, s.score]));
  await ctx.mode("s.scores", { cid, aid });
  const lines = [
    heading("🔢", `${a.title} (eng yuqori ball: ${a.maxScore})`), "",
    ...c.students.map((s, i) => `${i + 1}. ${esc(s.alias)}${have.has(s.id) ? `: <b>${have.get(s.id)}</b>` : ""}`),
    "", "Ballarni bitta xabarda yuboring, har qatorda bitta:",
    "<code>1 18\n2 15,5\nOybek 20</code>",
    `Yoki hamma ${c.students.length} ta o'quvchi uchun ballni tartib bilan, har qatorda bittadan yozing. Yuborilgan ball qayta yozilsa, yangilanadi.`,
  ];
  await ctx.show({ text: lines.join("\n"), kb: [[b("Tayyor / bekor qilish", `s.c.${cid}`)]] });
}

export async function onCb(ctx: Ctx, a: string[]) {
  const [act, x, y] = a;
  switch (act) {
    case "c": return x ? classScreen(ctx, x) : entry(ctx);
    case "new":
      await ctx.mode("s.n1");
      return ctx.show({ text: `${heading("➕", "Yangi sinf")}\nSinf nomini yozing. Masalan: <b>7-A</b>.`, kb: [[b("Bekor qilish", "s")]] });
    case "st": return x ? studentsScreen(ctx, x) : entry(ctx);
    case "sa":
      await ctx.mode("s.sadd", { cid: x });
      return ctx.show({ text: `${heading("➕", "O'quvchilarni qo'shish")}\nTaxalluslarni yozing: har qatorda bittadan yoki vergul bilan.\nMasalan: <code>O-1, O-2, Oybek</code>\n\n<i>Ism-familiya, telefon yoki email yozmang.</i>`, kb: [[b("Bekor qilish", `s.st.${x}`)]] });
    case "sd": {
      const c = await classDetail(ctx.userId, x);
      return ctx.show({ text: `${heading("🗑", "O'quvchini o'chirish")}\nO'chirmoqchi bo'lgan o'quvchini bosing (uning ballari ham o'chadi):`, kb: [...c.students.slice(0, 30).map((s) => [b(`🗑 ${clip(s.alias, 30)}`, `s.sx.${x}.${s.id}`)]), nav(`s.st.${x}`)] });
    }
    case "sx": await removeStudent(ctx.userId, x, y); await ctx.toast("O'chirildi"); return studentsScreen(ctx, x);
    case "as":
      await ctx.mode("s.a1", { cid: x });
      return ctx.show({ text: `${heading("📝", "Yangi baholash")}\nBaholash nomini yozing. Masalan: <b>Kasrlar bo'yicha nazorat ishi</b>.`, kb: [[b("Bekor qilish", `s.c.${x}`)]] });
    case "ak": {
      const kind = KIND_CODE[x];
      if (!kind || !ctx.state.data.cid) return entry(ctx);
      await ctx.mode("s.am", { ...ctx.state.data, kind });
      return ctx.show({ text: `${heading("🔢", "Eng yuqori ball")}\nBu baholashda eng yuqori ball qancha? Tugmani bosing yoki raqam yozing.`, kb: [[10, 20, 50, 100].map((n) => b(String(n), `s.am.${n}`))] });
    }
    case "am": return finishAssessment(ctx, Number(x));
    case "sc": return scoreAssessments(ctx, x);
    case "sq": return scoreInput(ctx, x, y);
    case "an": return analysis(ctx, x);
    case "del": return ctx.show({ text: `${heading("🗑", "Sinfni o'chirish")}\nSinf, uning o'quvchilari va barcha ballari butunlay o'chadi. Davom etamizmi?`, kb: [[b("Ha, o'chirish", `s.dy.${x}`), b("Yo'q", `s.c.${x}`)]] });
    case "dy": await deleteClass(ctx.userId, x); await ctx.toast("Sinf o'chirildi"); return entry(ctx);
    default: return entry(ctx);
  }
}

async function finishAssessment(ctx: Ctx, max: number) {
  const d = ctx.state.data as { cid?: string; title?: string; topic?: string; kind?: "BEFORE" | "AFTER" | "CURRENT" };
  if (!d.cid || !d.title || !d.topic || !d.kind) return entry(ctx);
  const input = assessmentInput.parse({ title: d.title, topic: d.topic, kind: d.kind, maxScore: max, date: uzToday() });
  const r = await saveAssessment(ctx.userId, d.cid, input);
  await ctx.idle();
  const text = `✅ Baholash qo'shildi: <b>${esc(d.title)}</b>\nMavzu: ${esc(d.topic)}, ${KIND_LABEL[d.kind]}, eng yuqori ball ${max}.`;
  const kb = [[b("🔢 Ball kiritish", `s.sq.${d.cid}.${r.id}`)], nav(`s.c.${d.cid}`)];
  if (ctx.cb) await ctx.show({ text, kb }); else await ctx.say({ text, kb });
}

export async function onText(ctx: Ctx, mode: string, text: string): Promise<boolean> {
  const d = ctx.state.data as Record<string, string>;
  if (mode === "s.n1") {
    const name = classInput.shape.name.parse(text);
    await ctx.mode("s.n2", { name });
    await ctx.say({ text: `Sinf: <b>${esc(name)}</b>\n\nEndi fan nomini yozing. Masalan: <b>Matematika</b>.`, kb: [[b("Bekor qilish", "s")]] });
    return true;
  }
  if (mode === "s.n2") {
    const subject = classInput.shape.subject.parse(text);
    const r = await createClass(ctx.userId, classInput.parse({ name: d.name, subject }));
    await ctx.idle();
    await ctx.say({ text: `✅ Sinf yaratildi: <b>${esc(d.name)}</b> · ${esc(subject)}`, kb: [[b("👥 O'quvchilarni qo'shish", `s.sa.${r.id}`)], [b("Sinfni ochish", `s.c.${r.id}`)]] });
    return true;
  }
  if (mode === "s.sadd") {
    const input = aliasesInput.parse({ aliases: splitAliases(text) });
    const r = await addStudents(ctx.userId, d.cid, input.aliases);
    await ctx.idle();
    await ctx.say({ text: `✅ Qo'shildi: <b>${r.added}</b> ta${r.skipped ? `, takroriy: ${r.skipped} ta` : ""}.`, kb: [[b("👥 O'quvchilar", `s.st.${d.cid}`)], [b("🔢 Ball kiritish", `s.sc.${d.cid}`)], nav(`s.c.${d.cid}`)] });
    return true;
  }
  if (mode === "s.a1") {
    const title = assessmentInput.shape.title.parse(text);
    await ctx.mode("s.a2", { cid: d.cid, title });
    await ctx.say({ text: `Baholash: <b>${esc(title)}</b>\n\nMavzusini yozing. Masalan: <b>Oddiy kasrlar</b>.`, kb: [[b("Bekor qilish", `s.c.${d.cid}`)]] });
    return true;
  }
  if (mode === "s.a2") {
    const topic = assessmentInput.shape.topic.parse(text);
    await ctx.mode("s.a3", { cid: d.cid, title: d.title, topic });
    await ctx.say({ text: `Mavzu: <b>${esc(topic)}</b>\n\nBu qanday baholash?\n<i>Mavzuni boshlashdan oldin «oldin», o'tgandan keyin «keyin» tanlansa, o'zgarish ko'rinadi.</i>`, kb: [[b("Boshlang'ich (oldin)", "s.ak.B")], [b("Yakuniy (keyin)", "s.ak.A")], [b("Joriy", "s.ak.C")]] });
    return true;
  }
  if (mode === "s.a3") { await ctx.say("Yuqoridagi tugmalardan birini tanlang."); return true; }
  if (mode === "s.am") {
    const n = Number(text.replace(",", "."));
    if (!Number.isInteger(n) || n < 1 || n > 1000) { await ctx.say("Eng yuqori ballni butun son bilan yozing (1 dan 1000 gacha). Masalan: <b>20</b>."); return true; }
    await finishAssessment(ctx, n);
    return true;
  }
  if (mode === "s.scores") {
    const c = await classDetail(ctx.userId, d.cid);
    const a = c.assessments.find((x) => x.id === d.aid);
    if (!a) { await ctx.idle(); await ctx.say("Baholash topilmadi."); return true; }
    const { scores, bad } = parseScores(text, c.students, a.maxScore);
    if (!Object.keys(scores).length) { await ctx.say(`Birorta ball o'qilmadi. Har qatorda: <code>1 18</code> (tartib raqami va ball). Eng yuqori ball: ${a.maxScore}.`); return true; }
    const input = scoresInput.parse({ scores });
    const r = await saveScores(ctx.userId, d.cid, d.aid, input.scores);
    await ctx.idle();
    await ctx.say({
      text: `✅ Saqlandi: <b>${r.saved}</b> ta natija.${bad.length ? `\n\n⚠️ O'qilmagan qatorlar:\n${bad.slice(0, 6).map((l) => `• ${esc(clip(l, 40))}`).join("\n")}\nQaytadan yuborishingiz mumkin.` : ""}`,
      kb: [[b("📊 Tahlil", `s.an.${d.cid}`)], [b("🔢 Yana ball kiritish", `s.sc.${d.cid}`)], nav(`s.c.${d.cid}`)],
    });
    return true;
  }
  return false;
}
