"use client";
import * as React from "react";
import { BoardStore, type BoardMsg, parseBoard } from "@/lib/board";
import { BlobAssembler, parseBlobChunk, splitBlob } from "@/lib/blob-chunks";
import { shrinkImage } from "@/lib/image-shrink";
import { MAX_DRAWERS, MAX_MATS, MAX_TIMER_SEC, type ClassState, type Material, type Seen, cleanUrl, emptyClass, makePoll, parseAct, parseClass, pickRandom, pollCounts } from "@/lib/class-tools";
import type { VEngine, VEvent, VPerson, VSession } from "./voice-engine";

const rid = () => Math.floor(Math.random() * 2 ** 31);
type Person = { identity: string; name: string };

/**
 * Dars asboblari holati. Ustozning brauzeri "haqiqat manbai": u holatni o'zgartiradi va hammaga yuboradi, o'quvchilar faqat qabul qiladi.
 * O'quvchi javoblari (ovoz, "tushundim") faqat ustozga boradi. Hech narsa bazaga yozilmaydi.
 */
export function useClassTools(engine: VEngine, session: VSession | null, people: VPerson[], onPick?: (p: Person) => void) {
  const isHost = !!session?.host;
  const [cls, setCls] = React.useState<ClassState>(emptyClass);
  const [timerEnd, setTimerEnd] = React.useState<number | null>(null);
  const [boardVer, setBoardVer] = React.useState(0);
  const [tick, setTick] = React.useState(0); // ustozda ovozlar o'zgarganda qayta chizish
  const [myVote, setMyVote] = React.useState<{ poll: number; o: number } | null>(null);
  const [myPulse, setMyPulse] = React.useState<{ id: number; v: number } | null>(null);
  const board = React.useMemo(() => new BoardStore(), []);
  const [images, setImages] = React.useState<ReadonlyMap<number, string>>(new Map());
  const imgBytes = React.useRef(new Map<number, Uint8Array>()); // ustozda: yangi kirganga qayta yuborish uchun
  const imgAsm = React.useMemo(() => new BlobAssembler(), []);
  const imgRef = React.useRef(images);
  imgRef.current = images;
  const clsRef = React.useRef(cls);
  const hostRef = React.useRef(isHost);
  const endRef = React.useRef<number | null>(null);
  const votes = React.useRef(new Map<string, number>());
  const pulses = React.useRef(new Map<string, 0 | 1 | 2>());
  const picked = React.useRef(new Set<string>());
  const known = React.useRef(new Set<string>());
  const seen = React.useRef(new Map<string, Seen>());
  const peopleRef = React.useRef(people);
  const nextId = React.useRef(rid());
  hostRef.current = isHost;
  peopleRef.current = people;
  const hostId = people.find((p) => p.host)?.identity;
  const hostIdRef = React.useRef(hostId);
  hostIdRef.current = hostId;
  const sessionRef = React.useRef(session);
  sessionRef.current = session;

  const wire = React.useCallback((c: ClassState): ClassState => {
    const left = endRef.current ? Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000)) : 0;
    return { ...c, timer: endRef.current && c.timer ? { left, total: c.timer.total } : null };
  }, []);

  /** Ustoz: holatni o'zgartiradi va hammaga yuboradi. */
  const publish = React.useCallback((next: ClassState) => {
    clsRef.current = next;
    setCls(next);
    void engine.sendJson("class", wire(next)).catch(() => {});
  }, [engine, wire]);
  const patch = React.useCallback((p: Partial<ClassState>) => publish({ ...clsRef.current, ...p }), [publish]);

  // Qabul qilish
  React.useEffect(() => engine.on((e: VEvent) => {
    if (e.type === "bin") {
      if (!e.from.host || hostRef.current) return; // rasm faqat ustozdan qabul qilinadi
      const c = parseBlobChunk(e.chunk);
      const done = c && imgAsm.add(c);
      if (!done) return;
      const url = URL.createObjectURL(new Blob([done.bytes as BlobPart], { type: "image/jpeg" }));
      setImages((m) => new Map(m).set(done.id, url));
      return;
    }
    if (e.type !== "json") return;
    if (e.topic === "act") {
      if (!hostRef.current || e.from.host) return;
      const a = parseAct(e.data);
      if (!a) return;
      const c = clsRef.current;
      if (a.t === "vote" && c.poll?.open && c.poll.id === a.poll && a.o < c.poll.opts.length) { votes.current.set(e.from.identity, a.o); setTick((t) => t + 1); }
      else if (a.t === "pulse" && c.pulse?.id === a.id) { pulses.current.set(e.from.identity, a.v); setTick((t) => t + 1); }
      return;
    }
    if (e.topic === "board") {
      const m = parseBoard(e.data);
      if (!m) return;
      if (!e.from.host) {
        // ustoz doskaga chaqirgan o'quvchi faqat chizishi va lazer ko'rsatishi mumkin
        if (!clsRef.current.draw.includes(e.from.identity) || (m.t !== "b" && m.t !== "l")) return;
      } else if (hostRef.current) return;
      if (board.apply(m)) setBoardVer((v) => v + 1);
      return;
    }
    if (hostRef.current || !e.from.host) return; // holat faqat ustozdan qabul qilinadi
    if (e.topic === "class") {
      const c = parseClass(e.data);
      if (!c) return;
      clsRef.current = c;
      setCls(c);
      const t = c.timer;
      setTimerEnd(t ? Date.now() + t.left * 1000 : null);
    }
  }), [engine, board, imgAsm]);

  // Chiqishda rasmlarning vaqtinchalik havolalari bo'shatiladi
  React.useEffect(() => () => { imgRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // Ustoz: yangi kirgan ishtirokchiga hozirgi holat va doskani yuboradi (qayta kirganga ham)
  React.useEffect(() => {
    if (!isHost) return;
    const here = new Set(people.filter((p) => !p.host && !p.me).map((p) => p.identity));
    for (const k of [...known.current]) if (!here.has(k)) known.current.delete(k);
    const fresh = [...here].filter((id) => !known.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => known.current.add(id));
    void (async () => {
      await engine.sendJson("class", wire(clsRef.current), fresh).catch(() => {});
      for (const id of new Set(board.pages.map((p) => p.img).filter(Boolean))) {
        const b = imgBytes.current.get(id);
        for (const part of (b && splitBlob(id, b)) || []) await engine.sendBin(part, fresh).catch(() => {});
      }
      for (const m of board.snapshot()) await engine.sendJson("board", m, fresh).catch(() => {});
    })();
  }, [isHost, people, engine, board, wire]);

  // Doskaga chaqirilgan o'quvchi xonadan chiqsa, ro'yxatdan olib tashlanadi
  React.useEffect(() => {
    if (!isHost) return;
    const ids = new Set(people.map((p) => p.identity));
    const keep = clsRef.current.draw.filter((id) => ids.has(id));
    if (keep.length !== clsRef.current.draw.length) publish({ ...clsRef.current, draw: keep });
  }, [isHost, people, publish]);

  // Davomat (ustozda): kim qachon kirgan
  React.useEffect(() => {
    if (!isHost) return;
    const now = Date.now();
    const here = new Set(people.filter((p) => !p.host && !p.me).map((p) => p.identity));
    let changed = false;
    for (const p of people) {
      if (p.host || p.me) continue;
      const s = seen.current.get(p.identity);
      if (!s) { seen.current.set(p.identity, { identity: p.identity, name: p.name, first: now, last: null }); changed = true; }
      else if (s.last !== null || s.name !== p.name) { s.last = null; s.name = p.name; changed = true; }
    }
    for (const s of seen.current.values()) if (!here.has(s.identity) && s.last === null) { s.last = now; changed = true; }
    if (changed) setTick((t) => t + 1); // gapirish holati o'zgarganda keraksiz qayta chizilmasin
  }, [isHost, people]);

  // ---- Ustoz amallari
  const startPoll = React.useCallback((q: string, opts: string[], correct: number | null) => {
    const poll = makePoll(rid(), q, opts, correct);
    if (!poll) return false;
    votes.current.clear();
    publish({ ...clsRef.current, poll });
    return true;
  }, [publish]);
  const closePoll = React.useCallback(() => { const p = clsRef.current.poll; if (p) publish({ ...clsRef.current, poll: { ...p, open: false } }); }, [publish]);
  const showPoll = React.useCallback((show: boolean) => {
    const p = clsRef.current.poll;
    if (!p) return;
    const present = new Set(peopleRef.current.map((x) => x.identity));
    publish({ ...clsRef.current, poll: { ...p, open: false, show, counts: show ? pollCounts(p.opts.length, votes.current, present) : null } });
  }, [publish]);
  const clearPoll = React.useCallback(() => { votes.current.clear(); publish({ ...clsRef.current, poll: null }); }, [publish]);
  const startPulse = React.useCallback(() => { pulses.current.clear(); publish({ ...clsRef.current, pulse: { id: rid() } }); }, [publish]);
  const stopPulse = React.useCallback(() => publish({ ...clsRef.current, pulse: null }), [publish]);
  const startTimer = React.useCallback((sec: number) => {
    const s = Math.max(1, Math.min(MAX_TIMER_SEC, Math.round(sec)));
    endRef.current = Date.now() + s * 1000;
    setTimerEnd(endRef.current);
    publish({ ...clsRef.current, timer: { left: s, total: s } });
  }, [publish]);
  const stopTimer = React.useCallback(() => { endRef.current = null; setTimerEnd(null); publish({ ...clsRef.current, timer: null }); }, [publish]);
  const pickStudent = React.useCallback((allowSpeak: boolean) => {
    const cand = peopleRef.current.filter((p) => !p.host && !p.me);
    const r = pickRandom(cand, picked.current, Math.random);
    if (!r) return null;
    if (r.reset) picked.current.clear();
    picked.current.add(r.pick.identity);
    publish({ ...clsRef.current, pick: { id: rid(), name: r.pick.name, who: r.pick.identity } });
    if (allowSpeak && !r.pick.canSpeak) onPick?.({ identity: r.pick.identity, name: r.pick.name });
    return r.pick;
  }, [publish, onPick]);
  const setDrawer = React.useCallback((identity: string, on: boolean) => {
    const cur = clsRef.current.draw.filter((id) => id !== identity);
    publish({ ...clsRef.current, draw: on ? [...cur, identity].slice(-MAX_DRAWERS) : cur });
  }, [publish]);
  const clearPick = React.useCallback(() => publish({ ...clsRef.current, pick: null }), [publish]);
  const addMat = React.useCallback((title: string, url: string): string | null => {
    const u = cleanUrl(url);
    if (!u) return "Havola noto'g'ri. https://... bilan boshlanadigan to'liq havolani yozing.";
    if (clsRef.current.mats.length >= MAX_MATS) return `Materiallar ${MAX_MATS} tadan oshmasin. Keraksizini o'chiring.`;
    const m: Material = { id: nextId.current++ % 2 ** 31, title: title.replace(/\s+/g, " ").trim().slice(0, 80) || u, url: u };
    publish({ ...clsRef.current, mats: [...clsRef.current.mats, m] });
    return null;
  }, [publish]);
  const removeMat = React.useCallback((id: number) => publish({ ...clsRef.current, mats: clsRef.current.mats.filter((m) => m.id !== id) }), [publish]);

  /** Doskaga ustoz chizgan xabar: ustozda hozir qo'llanadi (chizish komponenti o'zi qiladi), hammaga yuboriladi. */
  const boardNet = React.useCallback((m: BoardMsg) => { void engine.sendJson("board", m).catch(() => {}); }, [engine]);
  const boardChanged = React.useCallback(() => setBoardVer((v) => v + 1), []);

  /** Ustoz: rasm (varaq, kitob sahifasi) ni joriy sahifaga qo'yadi. Xato bo'lsa, xabar matnini qaytaradi. */
  const placeImage = React.useCallback(async (file: File): Promise<string | null> => {
    const bytes = await shrinkImage(file);
    if (!bytes) return "Rasm ochilmadi yoki juda katta. PNG, JPG yoki WebP rasm tanlang.";
    const id = rid();
    const parts = splitBlob(id, bytes);
    if (!parts) return "Rasm juda katta. Kichikroq rasm tanlang.";
    imgBytes.current.set(id, bytes);
    setImages((m) => new Map(m).set(id, URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/jpeg" }))));
    try { for (const part of parts) await engine.sendBin(part); } catch { return "Rasm yuborilmadi. Aloqani tekshiring."; }
    const m: BoardMsg = { t: "im", id };
    if (board.apply(m)) { void engine.sendJson("board", m).catch(() => {}); setBoardVer((v) => v + 1); }
    return null;
  }, [engine, board]);
  const clearImage = React.useCallback(() => {
    const m: BoardMsg = { t: "im", id: 0 };
    if (board.apply(m)) { void engine.sendJson("board", m).catch(() => {}); setBoardVer((v) => v + 1); }
  }, [engine, board]);

  // ---- O'quvchi amallari
  const vote = React.useCallback((o: number) => {
    const p = clsRef.current.poll;
    const to = hostIdRef.current;
    if (!p || !p.open || !to) return;
    setMyVote({ poll: p.id, o });
    void engine.sendJson("act", { t: "vote", poll: p.id, o }, [to]).catch(() => {});
  }, [engine]);
  const sendPulse = React.useCallback((v: 0 | 1 | 2) => {
    const p = clsRef.current.pulse;
    const to = hostIdRef.current;
    if (!p || !to) return;
    setMyPulse({ id: p.id, v });
    void engine.sendJson("act", { t: "pulse", id: p.id, v }, [to]).catch(() => {});
  }, [engine]);

  const present = new Set(people.map((p) => p.identity));
  const poll = cls.poll;
  const counts = poll ? pollCounts(poll.opts.length, votes.current, present) : [];
  const pulseCounts: [number, number, number] = [0, 0, 0];
  for (const [who, v] of pulses.current) if (present.has(who)) pulseCounts[v]++;
  void tick;

  return {
    imageUrl: images.get(board.image) ?? null, placeImage, clearImage,
    cls, isHost, canDraw: isHost || (!!session && cls.draw.includes(session.identity)), timerEnd, board, boardVer, boardChanged, boardNet, patch,
    host: { setDrawer, startPoll, closePoll, showPoll, clearPoll, startPulse, stopPulse, startTimer, stopTimer, pickStudent, clearPick, addMat, removeMat },
    counts, voters: poll ? [...votes.current.keys()].filter((id) => present.has(id)).length : 0, pulseCounts, pulseVoters: pulseCounts[0] + pulseCounts[1] + pulseCounts[2],
    attendance: [...seen.current.values()].sort((a, b) => a.first - b.first),
    guest: { vote, sendPulse, myVote: poll && myVote?.poll === poll.id ? myVote.o : null, myPulse: cls.pulse && myPulse?.id === cls.pulse.id ? myPulse.v : null },
  };
}
export type ClassApi = ReturnType<typeof useClassTools>;
