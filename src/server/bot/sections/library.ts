import { db } from "../../db";
import { askDoc, deleteDoc, downloadUrl, getLibraryDoc, listLibrary, requestPublic, storageState, toggleFavorite, uploadDoc, uploadMeta } from "../../library";
import { MAX_FILE_BYTES } from "../../librarylogic";
import { clip, esc, safeUrl } from "../botlogic";
import type { Ctx } from "../ctx";
import { b, downloadFile, link, type Btn } from "../tg";
import { heading, nav } from "../ui";

/** BILIMXONA kutubxonasi botda: qidirish, ro'yxat, sevimlilar, yuklab olish, hujjatdan so'rash, fayl yuklash (chatga fayl yuborish). */
type Scope = "a" | "m" | "f";
const SCOPE_NAME: Record<Scope, string> = { a: "Hammasi", m: "Mening hujjatlarim", f: "Sevimlilar" };
const SCOPE_PARAM: Record<Scope, string | undefined> = { a: undefined, m: "mine", f: "favorites" };

async function viewer(ctx: Ctx) {
  const roles = await db.userRole.findMany({ where: { userId: ctx.userId }, select: { role: true } });
  return { id: ctx.userId, roles };
}

const mb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export async function entry(ctx: Ctx) {
  await ctx.idle();
  const st = storageState();
  const lines = [heading("📖", "Kutubxona"), "Metodik materiallar, hujjatlar va sizning fayllaringiz.", ""];
  lines.push(st.configured ? `📤 Fayl yuklash: PDF, DOCX yoki TXT faylni shu chatga yuboring (${Math.round(MAX_FILE_BYTES / 1_000_000)} MB gacha).` : "📤 Fayl yuklash hozircha ulanmagan.");
  await ctx.show({ text: lines.join("\n"), kb: [[b("🔎 Qidirish", "l.s")], [b("🌐 Hammasi", "l.l.a.0"), b("⭐ Sevimlilar", "l.l.f.0")], [b("📁 Mening hujjatlarim", "l.l.m.0")], nav()] });
}

async function list(ctx: Ctx, scope: Scope | "q", page: number) {
  const v = await viewer(ctx);
  const term = scope === "q" ? String(ctx.state.data.q ?? "") : undefined;
  const r = await listLibrary(v, { page: page + 1, ...(scope === "q" ? { q: term } : { scope: SCOPE_PARAM[scope] }) });
  const title = scope === "q" ? `Qidiruv: «${clip(term ?? "", 30)}»` : SCOPE_NAME[scope];
  const lines = [heading("📖", title), r.total ? `Topildi: ${r.total} ta.` : "Hech narsa topilmadi."];
  const base = scope === "q" ? "l.l.q" : `l.l.${scope}`;
  const kb: Btn[][] = r.docs.slice(0, 8).map((d) => [b(`${d.type === "PDF" ? "📕" : d.type === "DOCX" ? "📘" : "📄"} ${clip(d.title, 36)}${d.favorite ? " ⭐" : ""}`, `l.o.${d.id}`)]);
  if (r.pages > 1) kb.push([...(page > 0 ? [b("◀️", `${base}.${page - 1}`)] : []), b(`${page + 1}/${r.pages}`, "x"), ...(page + 1 < r.pages ? [b("▶️", `${base}.${page + 1}`)] : [])]);
  kb.push(nav("l"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function card(ctx: Ctx, id: string) {
  const v = await viewer(ctx);
  const d = await getLibraryDoc(v, id);
  const lines = [
    heading(d.type === "PDF" ? "📕" : d.type === "DOCX" ? "📘" : "📄", d.title),
    `${d.type} · ${mb(d.sizeBytes)}${d.subject ? ` · ${esc(d.subject)}` : ""}`,
    d.mine ? "Sizning faylingiz" : d.owner ? `Muallif: ${esc(d.owner)}` : "",
    d.mine ? (d.visibility === "PUBLIC" ? "🌐 Ommaviy" : d.visibility === "PUBLIC_PENDING" ? "⏳ Ommaviy qilish tekshiruvda" : "🔒 Shaxsiy") : "",
    d.tags.length ? `🏷 ${d.tags.map(esc).join(", ")}` : "",
  ].filter(Boolean);
  const kb: Btn[][] = [];
  const dl = await downloadUrl(v, id).then((x) => safeUrl(x.url)).catch(() => null);
  if (dl) kb.push([link("⬇️ Yuklab olish", dl)]);
  kb.push([b(d.favorite ? "⭐ Sevimlilardan olish" : "☆ Sevimliga qo'shish", `l.fv.${id}`)]);
  if (d.status === "READY") kb.push([b("💬 Hujjatdan so'rash", `l.ask.${id}`)]);
  if (d.mine && d.visibility === "PRIVATE") kb.push([b("🌐 Ommaviy qilishni so'rash", `l.pub.${id}`)]);
  if (d.mine) kb.push([b("🗑 O'chirish", `l.del.${id}`)]);
  kb.push(nav("l"));
  await ctx.show({ text: lines.join("\n"), kb });
}

export async function onCb(ctx: Ctx, a: string[]) {
  const [act, x, y] = a;
  const v = () => viewer(ctx);
  switch (act) {
    case "s":
      await ctx.mode("l.search");
      return ctx.show({ text: `${heading("🔎", "Qidirish")}\nHujjat nomi, fani yoki teg bo'yicha so'z yozing.`, kb: [[b("Bekor qilish", "l")]] });
    case "l": return list(ctx, x as Scope | "q", Number(y) || 0);
    case "o": return x ? card(ctx, x) : entry(ctx);
    case "fv": { const r = await toggleFavorite(await v(), x); await ctx.toast(r.favorite ? "Sevimlilarga qo'shildi ⭐" : "Sevimlilardan olindi"); return card(ctx, x); }
    case "ask":
      await ctx.mode("l.ask", { id: x });
      return ctx.show({ text: `${heading("💬", "Hujjatdan so'rash")}\nSavolingizni yozing. Javob faqat shu hujjat ichidan olinadi, topilmasa shunday deyiladi.`, kb: [[b("Bekor qilish", `l.o.${x}`)]] });
    case "pub": await requestPublic(await v(), x); await ctx.toast("So'rov yuborildi: administrator tekshiradi", true); return card(ctx, x);
    case "del": return ctx.show({ text: `${heading("🗑", "Hujjatni o'chirish")}\nFayl butunlay o'chadi. Davom etamizmi?`, kb: [[b("Ha, o'chirish", `l.dy.${x}`), b("Yo'q", `l.o.${x}`)]] });
    case "dy": await deleteDoc(await v(), x); await ctx.toast("O'chirildi"); return entry(ctx);
    default: return entry(ctx);
  }
}

export async function onText(ctx: Ctx, mode: string, text: string): Promise<boolean> {
  if (mode === "l.search" || mode === "l.q") {
    const q = text.trim().slice(0, 80);
    if (q.length < 2) { await ctx.say("Qidiruv so'zi kamida 2 belgi bo'lsin."); return true; }
    await ctx.mode("l.q", { q });
    return list(ctx, "q", 0).then(() => true);
  }
  if (mode === "l.ask") {
    const id = String(ctx.state.data.id ?? "");
    await ctx.say("⏳ Hujjatdan javob izlanmoqda…");
    const r = await askDoc(await viewer(ctx), id, text.trim().slice(0, 500));
    await ctx.idle();
    const parts: string[] = [];
    if (r.answer) parts.push(r.answer);
    else if (r.note) parts.push(r.note);
    if (r.sources.length) parts.push("Manbalar:\n" + r.sources.slice(0, 3).map((s) => `${s.n}) ${clip(s.text, 220)}`).join("\n"));
    await ctx.plain(parts.join("\n\n") || "Javob topilmadi.", [[b("💬 Yana savol", `l.ask.${id}`)], [b("📄 Hujjat", `l.o.${id}`)], nav("l")]);
    return true;
  }
  return false;
}

/** Foydalanuvchi chatga fayl yuborganda: kutubxonaga yuklanadi (nomi fayl nomidan olinadi). */
export async function onFile(ctx: Ctx, f: { file_id: string; file_name?: string; file_size?: number }) {
  if (!storageState().configured) return ctx.say({ text: "📤 Fayl yuklash hozircha ulanmagan. Administrator saqlash xizmatini yoqqach ishlaydi.", kb: [nav()] });
  if ((f.file_size ?? 0) > MAX_FILE_BYTES) return ctx.say({ text: `Fayl juda katta: ${Math.round(MAX_FILE_BYTES / 1_000_000)} MB dan oshmasin.`, kb: [nav("l")] });
  const name = f.file_name || "hujjat";
  const bytes = await downloadFile(f.file_id, MAX_FILE_BYTES);
  if (!bytes) return ctx.say({ text: "Faylni olib bo'lmadi. Qayta yuboring.", kb: [nav("l")] });
  const meta = uploadMeta.parse({ title: name.replace(/\.[^.]+$/, "").slice(0, 160) || "Hujjat" });
  const r = await uploadDoc(await viewer(ctx), { name, bytes }, meta);
  await ctx.say({ text: `✅ Yuklandi: <b>${esc(clip(meta.title, 80))}</b>${r.indexed ? "\nMatn o'qildi: hujjatdan savol berish mumkin." : "\nMatn o'qilmadi (hozircha faqat TXT va DOCX matni o'qiladi)."}`, kb: [[b("📁 Mening hujjatlarim", "l.l.m.0")], nav("l")] });
}
