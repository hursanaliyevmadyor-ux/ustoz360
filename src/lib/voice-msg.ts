/** Ovozli xonadagi qisqa xabarlar (chat va qo'l ko'tarish): LiveKit ma'lumot kanalida JSON sifatida yuboriladi. */
export const MAX_CHAT = 500;
export type VoiceMsg = { t: "chat"; text: string } | { t: "hand"; up: boolean };
export type VoiceTopic = "chat" | "hand";

const enc = new TextEncoder();
const dec = new TextDecoder();

export const encodeMsg = (m: VoiceMsg): Uint8Array => enc.encode(JSON.stringify(m));

/** Boshqa ishtirokchidan kelgan xabarni tekshiradi: noto'g'ri shakl yoki bo'sh matn bo'lsa null (hech qachon xato tashlamaydi). */
export function decodeMsg(data: Uint8Array | string, topic: string | undefined): VoiceMsg | null {
  try {
    const v: unknown = JSON.parse(typeof data === "string" ? data : dec.decode(data));
    if (!v || typeof v !== "object") return null;
    const o = v as { t?: unknown; text?: unknown; up?: unknown };
    if (topic === "chat" && o.t === "chat" && typeof o.text === "string") {
      // eslint-disable-next-line no-control-regex
      const text = o.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, MAX_CHAT);
      return text ? { t: "chat", text } : null;
    }
    if (topic === "hand" && o.t === "hand" && typeof o.up === "boolean") return { t: "hand", up: o.up };
    return null;
  } catch {
    return null;
  }
}

/** Metadata (token ichida) ustozmi yoki yo'qmi. */
export function roleOf(metadata: string | undefined): "host" | "guest" {
  try { return (JSON.parse(metadata ?? "{}") as { r?: unknown }).r === "host" ? "host" : "guest"; } catch { return "guest"; }
}

/** Ishtirokchilar tartibi: avval ustoz, keyin o'zim, keyin qo'l ko'targanlar, keyin ism bo'yicha. */
export function sortPeople<T extends { host: boolean; me: boolean; name: string; identity: string }>(list: T[], hands: ReadonlySet<string>): T[] {
  const rank = (p: T) => (p.host ? 0 : p.me ? 1 : hands.has(p.identity) ? 2 : 3);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "uz") || a.identity.localeCompare(b.identity));
}
