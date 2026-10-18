import { listPublicSeminars } from "../../admin";
import { clip, esc, fmtWhen, safeUrl } from "../botlogic";
import type { Ctx } from "../ctx";
import { b, link, type Btn } from "../tg";
import { heading, nav } from "../ui";

/** Yaqin seminarlar: administrator kiritgan faol tadbirlar. */
export async function entry(ctx: Ctx) {
  await ctx.idle();
  const { seminars } = await listPublicSeminars();
  const lines = [heading("📅", "Seminarlar"), seminars.length ? "Yaqin tadbirlar (Toshkent vaqti bilan). Batafsil uchun bosing." : "Hozircha rejalashtirilgan seminar yo'q. Yangisi qo'shilsa, kunlik eslatmada xabar beramiz."];
  const kb: Btn[][] = seminars.slice(0, 8).map((s) => [b(`${fmtWhen(s.startsAt).split(", ").slice(0, 1)[0]} · ${clip(s.title, 34)}`, `n.o.${s.id}`)]);
  kb.push(nav());
  await ctx.show({ text: lines.join("\n"), kb });
}

export async function onCb(ctx: Ctx, a: string[]) {
  if (a[0] !== "o" || !a[1]) return entry(ctx);
  const { seminars } = await listPublicSeminars();
  const s = seminars.find((x) => x.id === a[1]);
  if (!s) return ctx.toast("Seminar topilmadi yoki tugagan.", true);
  const lines = [
    heading("📅", s.title), `🕒 ${fmtWhen(s.startsAt)}${s.durationMin ? `, ${s.durationMin} daqiqa` : ""}`,
    s.place ? `📍 ${esc(s.place)}` : "", s.speaker ? `🎤 ${esc(s.speaker)}` : "", s.capacity ? `👥 Joylar: ${s.capacity} ta` : "",
    s.description ? `\n${esc(clip(s.description, 600))}` : "",
  ].filter(Boolean);
  const url = safeUrl(s.link);
  await ctx.show({ text: lines.join("\n"), kb: [...(url ? [[link("🔗 Qatnashish havolasi", url)]] : []), nav("n")] });
}
