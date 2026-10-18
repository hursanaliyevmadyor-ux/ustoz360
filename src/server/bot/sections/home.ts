import { patchPlanItem } from "../../toifa";
import { clip, dayLabel, esc, fmtWhen } from "../botlogic";
import type { Ctx } from "../ctx";
import { digest, type Digest } from "../digest";
import { b, type Btn, type Screen } from "../tg";
import { heading } from "../ui";

/** Bosh sahifa: bugungi reja (bosib belgilanadi), davom ettiriladigan test, takrorlash, yaqin seminar va e'lonlar. */
export function homeScreen(name: string, d: Digest): Screen {
  const lines = [heading("🏠", "Bosh sahifa"), `Salom${name ? `, ${esc(name)}` : ""}!`, ""];
  lines.push(`📅 <b>Bugun, ${dayLabel(d.today)}</b>`);
  if (d.plan.length) for (const p of d.plan) lines.push(`${p.done ? "✅" : "⬜"} ${esc(clip(p.title, 80))}`);
  else lines.push(d.planFuture ? "Bugunga reja yo'q. Keyingi kunlar uchun reja bor." : "Reja hali yo'q. «🧭 TOIFA reja» bo'limida tuzing.");
  if (d.daysLeft !== null) lines.push("", `🎯 Imtihongacha <b>${d.daysLeft}</b> kun qoldi`);
  if (d.resume) lines.push("", `▶️ Tugallanmagan mashq: ${d.resume.answered}/${d.resume.total}`);
  if (d.dueErrors) lines.push("", `🔁 Takrorlash vaqti kelgan xatolar: <b>${d.dueErrors}</b> ta`);
  if (d.seminars.length) lines.push("", `📅 Yaqin seminar: <b>${esc(clip(d.seminars[0].title, 70))}</b>, ${fmtWhen(d.seminars[0].startsAt)}`);
  for (const a of d.announcements) lines.push("", `📢 <b>${esc(clip(a.title, 80))}</b>${a.text ? `\n${esc(clip(a.text, 200))}` : ""}`);

  const kb: Btn[][] = d.plan.slice(0, 6).map((p) => [b(`${p.done ? "✅" : "⬜"} ${clip(p.title, 34)}`, `h.pt.${p.id}.${p.done ? 0 : 1}`)]);
  const row1: Btn[] = [];
  if (d.resume) row1.push(b("▶️ Davom ettirish", `t.n.${d.resume.id}`));
  else row1.push(b("⚡ Tezkor mashq", "t.q"));
  if (d.dueErrors) row1.push(b("🔁 Xatolar", "t.e"));
  kb.push(row1);
  kb.push([b("🧭 Reja", "p"), b("📅 Seminarlar", "n"), b("👤 Profil", "u")]);
  return { text: lines.join("\n"), kb };
}

export async function entry(ctx: Ctx) {
  await ctx.idle();
  await ctx.show(homeScreen(ctx.name, await digest(ctx.userId)));
}

export async function onCb(ctx: Ctx, a: string[]) {
  if (a[0] === "pt" && a[1]) {
    await patchPlanItem(ctx.userId, a[1], { done: a[2] === "1" });
    await ctx.toast(a[2] === "1" ? "Bajarildi ✅" : "Belgi olib tashlandi");
  }
  return entry(ctx);
}
