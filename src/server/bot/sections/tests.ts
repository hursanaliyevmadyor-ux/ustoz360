import { homeData, errorsProgress, finishPractice, giveHint, knowledgeMap, practiceHistory, practiceResult, practiceView, startPractice, submitAnswer, topicsData } from "../../practice";
import { bar, clip, esc, fmtDate } from "../botlogic";
import type { Ctx } from "../ctx";
import { b, link, type Btn, type Screen } from "../tg";
import { heading, nav } from "../ui";

/** USTOZ AI testlari botda: savol tugmalar bilan keladi, javob darhol tekshiriladi, natija shu yerning o'zida. Vaqtli testlar saytda. */
const PAGE = 8;

type View = Awaited<ReturnType<typeof practiceView>>;
type Item = View["items"][number];

const questionBlock = (item: Item, i: number, total: number) => [
  `❓ <b>Savol ${i + 1}/${total}</b>${item.topic ? ` · ${esc(clip(item.topic, 40))}` : ""}`,
  item.sample ? "ℹ️ <i>Namunaviy savol</i>" : "",
  "",
  esc(clip(item.text, 1500)),
  "",
  ...item.options.map((o) => `<b>${o.label})</b> ${esc(clip(o.text, 300))}`),
].filter((l, idx, all) => l !== "" || (all[idx - 1] ?? "x") !== "").join("\n");

export async function entry(ctx: Ctx) {
  await ctx.idle();
  const h = await homeData(ctx.userId);
  const lines = [heading("📚", "Testlar"), "Bilimingizni mashq qilib sinab ko'ring. Savol tugmalar bilan keladi, javob darhol tekshiriladi.", ""];
  if (h.active) lines.push(`▶️ Tugallanmagan mashq: ${h.active.answered}/${h.active.total}`);
  if (h.errorsDue) lines.push(`🔁 Takrorlash vaqti kelgan xatolar: <b>${h.errorsDue}</b> ta`);
  lines.push(`Savollar bazasida: ${h.approved} ta tasdiqlangan savol.`);
  const kb: Btn[][] = [];
  if (h.active) kb.push([b("▶️ Davom ettirish", `t.n.${h.active.id}`)]);
  kb.push([b("⚡ Tezkor mashq (5 savol)", "t.q")], [b("📖 Mavzu bo'yicha mashq", "t.sub")]);
  kb.push([b(`🔁 Xatolar ustida ishlash${h.errorsOpen ? ` (${h.errorsOpen})` : ""}`, "t.e")], [b("📊 Natijalarim va bilim xaritasi", "t.r")]);
  kb.push([link("🩺 Diagnostika va vaqtli test (saytda)", `${ctx.origin}/ustoz-ai`)], nav());
  await ctx.show({ text: lines.join("\n"), kb });
}

async function begin(ctx: Ctx, input: Parameters<typeof startPractice>[1]) {
  const r = await startPractice(ctx.userId, input);
  if (r.short) await ctx.toast(`Savollar kam: ${r.count} ta.`);
  return question(ctx, r.id);
}

async function question(ctx: Ctx, sid: string) {
  const v = await practiceView(ctx.userId, sid);
  if (v.policy === "deferred") {
    return ctx.show({ text: `${heading("🕒", v.kindLabel)}\nBu test vaqt bilan va yakunda tekshiriladi, shuning uchun saytda davom ettiriladi.`, kb: [[link("Saytda ochish", `${ctx.origin}/ustoz-ai/testlar/${sid}`)], nav("t")] });
  }
  if (v.status !== "IN_PROGRESS") return result(ctx, sid);
  const i = v.items.findIndex((x) => !x.answer);
  if (i < 0) return result(ctx, sid);
  const item = v.items[i];
  const letters: Btn[] = item.options.map((o, oi) => b(o.label, `t.a.${sid}.${i}.${oi}`));
  const kb: Btn[][] = [letters.slice(0, 4), ...(letters.length > 4 ? [letters.slice(4, 8)] : [])];
  const tools: Btn[] = [];
  if (!item.hintOptionId && item.options.length > 2) tools.push(b("💡 Ishora", `t.h.${sid}.${i}`));
  tools.push(b("⏹ Tugatish", `t.f.${sid}`));
  kb.push(tools);
  const hint = item.hintOptionId ? item.options.find((o) => o.id === item.hintOptionId) : null;
  await ctx.show({ text: `${questionBlock(item, i, v.total)}${hint ? `\n\n💡 <i>${hint.label} variant noto'g'ri.</i>` : ""}`, kb });
}

async function answer(ctx: Ctx, sid: string, qi: number, oi: number) {
  const v = await practiceView(ctx.userId, sid);
  const item = v.items[qi], opt = item?.options[oi];
  if (!item || !opt) return question(ctx, sid);
  const r = await submitAnswer(ctx.userId, sid, item.id, opt.id);
  const right = item.options.find((o) => o.id === r.correctOptionId);
  const verdict = r.isCorrect ? "✅ <b>To'g'ri!</b>" : `❌ <b>Noto'g'ri.</b>${right ? ` To'g'ri javob: <b>${right.label})</b> ${esc(clip(right.text, 200))}` : ""}`;
  const text = [questionBlock(item, qi, v.total), "", `Siz tanladingiz: <b>${opt.label})</b>`, verdict, r.explanation ? `\n💡 ${esc(clip(r.explanation, 700))}` : ""].join("\n");
  await ctx.show({ text, kb: r.finished ? [[b("🏁 Natijani ko'rish", `t.f.${sid}`)]] : [[b("➡️ Keyingi savol", `t.n.${sid}`)], [b("⏹ Tugatish", `t.f.${sid}`)]] });
}

async function result(ctx: Ctx, sid: string) {
  const r = await finishPractice(ctx.userId, sid);
  const lines = [`🏁 <b>Natija: ${r.score}/${r.total} (${r.percent}%)</b>`, `${bar(r.percent)}  ${esc(r.kindLabel)}`, "", `<b>${esc(r.headline.title)}</b>`, esc(r.headline.text)];
  if (r.approximate) lines.push("", "<i>Savollar kam bo'lgani uchun natija taxminiy.</i>");
  if (r.topics.length) lines.push("", "📚 <b>Mavzular</b>", ...r.topics.slice(0, 5).map((t) => `• ${esc(clip(t.name, 40))}: ${t.correct}/${t.total}`));
  if (r.wrong.length) {
    lines.push("", "⚠️ <b>Xato javoblar</b>");
    for (const w of r.wrong.slice(0, 3)) lines.push(`• ${esc(clip(w.text, 110))}\n   To'g'ri: <b>${esc(clip(w.correct ?? "-", 100))}</b>`);
    if (r.wrong.length > 3) lines.push(`…yana ${r.wrong.length - 3} ta`);
  }
  lines.push("", `➡️ ${esc(r.next.text)}`);
  const kb: Btn[][] = [[b("🔁 Yana mashq", `t.again.${sid}`)]];
  if (r.wrong.length) kb.push([b("🔁 Xatolar ustida ishlash", "t.e")]);
  kb.push([b("📊 Natijalarim", "t.r")], nav("t"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function results(ctx: Ctx) {
  const [hist, map, err] = await Promise.all([practiceHistory(ctx.userId, { days: 60 }), knowledgeMap(ctx.userId), errorsProgress(ctx.userId)]);
  const lines = [heading("📊", "Natijalarim"), ""];
  const done = hist.filter((h) => h.status === "SUBMITTED").slice(0, 6);
  if (done.length) {
    lines.push("<b>Oxirgi mashqlar</b>");
    for (const h of done) lines.push(`• ${fmtDate(h.at.toISOString())} ${esc(h.kindLabel)}: ${h.score}/${h.total}${h.total ? ` (${Math.round((h.score / h.total) * 100)}%)` : ""}`);
  } else lines.push("Hali yakunlangan mashq yo'q. «⚡ Tezkor mashq» bilan boshlang.");
  const seen = map.filter((m) => m.total > 0).sort((a, c) => a.correct / a.total - c.correct / c.total);
  if (seen.length) {
    lines.push("", "<b>Mavzular holati</b> (kuchsizdan boshlab)");
    for (const m of seen.slice(0, 6)) lines.push(`${m.correct / m.total < 0.6 ? "⚠️" : m.correct / m.total >= 0.85 ? "🟢" : "🟡"} ${esc(clip(m.name, 38))}: ${m.correct}/${m.total} (${Math.round((m.correct / m.total) * 100)}%)`);
  }
  lines.push("", `🔁 Ochiq xatolar: <b>${err.open}</b>, takrorlash vaqti kelgan: <b>${err.due}</b>, o'zlashtirilgan: ${err.mastered}`);
  await ctx.show({ text: lines.join("\n"), kb: [err.open ? [b("🔁 Xatolar ustida ishlash", "t.e")] : [], [b("⚡ Tezkor mashq", "t.q")], nav("t")] });
}

async function subjects(ctx: Ctx) {
  const d = await topicsData(ctx.userId);
  const list = d.subjects.filter((s) => s.topics.some((t) => t.total > 0));
  if (!list.length) return ctx.show({ text: `${heading("📖", "Mavzu bo'yicha mashq")}\nHozircha tasdiqlangan savollar yo'q.`, kb: [nav("t")] });
  await ctx.show({ text: `${heading("📖", "Mavzu bo'yicha mashq")}\nFanni tanlang:`, kb: [...list.map((s) => [b(clip(s.name, 40), `t.top.${s.id}.0`)]), nav("t")] });
}

async function topics(ctx: Ctx, sid: string, page: number) {
  const d = await topicsData(ctx.userId);
  const s = d.subjects.find((x) => x.id === sid);
  const list = (s?.topics ?? []).filter((t) => t.total > 0);
  if (!s || !list.length) return subjects(ctx);
  const pages = Math.max(1, Math.ceil(list.length / PAGE)), p = Math.min(Math.max(0, page), pages - 1);
  const kb: Btn[][] = list.slice(p * PAGE, p * PAGE + PAGE).map((t) => [b(`${clip(t.name, 36)} (${t.total})`, `t.go.${t.id}`)]);
  if (pages > 1) kb.push([...(p > 0 ? [b("◀️", `t.top.${sid}.${p - 1}`)] : []), b(`${p + 1}/${pages}`, "x"), ...(p < pages - 1 ? [b("▶️", `t.top.${sid}.${p + 1}`)] : [])]);
  kb.push(nav("t.sub"));
  await ctx.show({ text: `${heading("📖", s.name)}\nMavzuni tanlang. Har mavzuda 10 tagacha savol beriladi.`, kb });
}

export async function onCb(ctx: Ctx, a: string[]) {
  const [act, x, y, z] = a;
  if (act === "q") return begin(ctx, { kind: "quick", count: 5 });
  if (act === "e") {
    const e = await errorsProgress(ctx.userId);
    if (!e.open) return ctx.toast("Xatolar daftari bo'sh: hali xato qilingan savol yo'q.", true);
    return begin(ctx, { kind: "errors", variant: "old", count: 10 });
  }
  if (act === "go" && x) return begin(ctx, { kind: "topic", topicIds: [x], count: 10 });
  if (act === "n" && x) return question(ctx, x);
  if (act === "a" && x) return answer(ctx, x, Number(y), Number(z));
  if (act === "f" && x) return result(ctx, x);
  if (act === "h" && x) {
    const v = await practiceView(ctx.userId, x);
    const item = v.items[Number(y)];
    if (!item) return question(ctx, x);
    await giveHint(ctx.userId, x, item.id);
    await ctx.toast("Bitta noto'g'ri variant belgilandi.");
    return question(ctx, x);
  }
  if (act === "again" && x) {
    const r = await practiceResult(ctx.userId, x);
    const k = r.again.kind;
    return begin(ctx, k === "errors" ? { kind: "errors", variant: "old", count: 10 } : k === "topic" && r.again.topicIds.length ? { kind: "topic", topicIds: r.again.topicIds, count: 10 } : { kind: "quick", count: 5 });
  }
  if (act === "r") return results(ctx);
  if (act === "sub") return subjects(ctx);
  if (act === "top" && x) return topics(ctx, x, Number(y) || 0);
  return entry(ctx);
}

export type { Screen };
