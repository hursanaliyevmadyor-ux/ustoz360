import { ConnectionState, Room, RoomEvent, Track, VideoPresets, type Participant } from "livekit-client";
import type { VoiceMode } from "@/lib/voice-mode";
import { decodeMsg, encodeMsg, roleOf, type VoiceMsg, type VoiceTopic } from "@/lib/voice-msg";

/**
 * Dars xonasining LiveKit bilan ishlaydigan qatlami (ovoz, kamera, ekran ulashish, ma'lumot kanali).
 * Ekran (voice-room.tsx) faqat shu oddiy interfeysni biladi: keyinroq LiveKit o'rniga boshqa xizmat qo'yilsa, ekran o'zgarmaydi;
 * sinovda soxta engine beriladi.
 */
export type VPerson = { identity: string; name: string; host: boolean; speaking: boolean; micOn: boolean; camOn: boolean; screenOn: boolean; canSpeak: boolean; me: boolean };
export type VState = "connecting" | "live" | "reconnecting" | "ended";
export type VSource = "camera" | "screen";
export type VEvent =
  | { type: "roster"; people: VPerson[] }
  | { type: "data"; topic: VoiceTopic; from: { identity: string; name: string; host: boolean }; msg: VoiceMsg }
  | { type: "clip"; from: { identity: string; name: string; host: boolean }; chunk: Uint8Array }
  | { type: "state"; state: VState; reason?: string }
  | { type: "audio"; blocked: boolean };
export type VSession = { identity: string; host: boolean; canSpeak: boolean };
/** Kirishdagi tanlov: mikrofon va kamera yoqiq kirsinmi, qaysi qurilma. Faqat ruxsati bor (ustoz yoki erkin rejim) ishtirokchiga qo'llanadi. */
export type VPrefs = { audio: boolean; video: boolean; camId?: string; micId?: string };
export type VEngine = {
  connect(): Promise<VSession>;
  disconnect(): void;
  setMic(on: boolean, deviceId?: string): Promise<void>;
  setCam(on: boolean, deviceId?: string): Promise<void>;
  setScreen(on: boolean): Promise<void>;
  /** Ishtirokchining videosini <video> elementiga ulaydi; qaytgan funksiya ajratadi. */
  attachVideo(identity: string, el: HTMLVideoElement, source: VSource): () => void;
  send(topic: VoiceTopic, msg: VoiceMsg): Promise<void>;
  /** Ovozli xabarning bitta paketi (voice-clip.ts). Paketlar ketma-ket yuboriladi. */
  sendClip(chunk: Uint8Array): Promise<void>;
  startAudio(): Promise<void>;
  on(fn: (e: VEvent) => void): () => void;
};

export class VoiceError extends Error {}

const ERRORS: Record<string, string> = {
  voice_off: "Dars xonasi hozircha ishlamayapti.",
  bad_link: "Havola noto'g'ri yoki eskirgan. Ustozdan yangi havola so'rang.",
};

export function createLiveKitEngine(o: { code: string; mode: VoiceMode; k: string; h?: string; name: string; prefs?: VPrefs }): VEngine {
  let room: Room | null = null;
  let holder: HTMLDivElement | null = null;
  const subs = new Set<(e: VEvent) => void>();
  const emit = (e: VEvent) => subs.forEach((f) => f(e));

  const person = (p: Participant, me: boolean): VPerson => {
    const cam = p.getTrackPublication(Track.Source.Camera);
    const scr = p.getTrackPublication(Track.Source.ScreenShare);
    // Boshqalar uchun video ko'rinadi, agar kuzatuv (track) ulangan va o'chirilmagan bo'lsa.
    const on = (pub: typeof cam) => (me ? !!pub && !pub.isMuted : !!pub?.track && !pub.isMuted);
    return {
      identity: p.identity, name: p.name || p.identity, host: roleOf(p.metadata) === "host",
      speaking: p.isSpeaking, micOn: p.isMicrophoneEnabled, camOn: on(cam), screenOn: on(scr), canSpeak: !!p.permissions?.canPublish, me,
    };
  };
  const roster = () => {
    if (!room) return;
    emit({ type: "roster", people: [person(room.localParticipant, true), ...[...room.remoteParticipants.values()].map((p) => person(p, false))] });
  };
  const find = (identity: string) => (room?.localParticipant.identity === identity ? room.localParticipant : room?.remoteParticipants.get(identity));

  return {
    async connect() {
      emit({ type: "state", state: "connecting" });
      let d: { token?: string; url?: string; role?: string; identity?: string; canSpeak?: boolean; error?: string; code?: string };
      try {
        const r = await fetch("/api/dars/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: o.code, mode: o.mode, k: o.k, ...(o.h && { h: o.h }), name: o.name }) });
        d = await r.json().catch(() => ({}));
        if (!r.ok || !d.token || !d.url) throw new VoiceError((d.code && ERRORS[d.code]) || d.error || "Xonaga ulanib bo'lmadi.");
      } catch (e) {
        if (e instanceof VoiceError) throw e;
        throw new VoiceError("Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring.");
      }
      const host = d.role === "host";
      const rm = new Room({
        adaptiveStream: true, // ko'rinayotgan o'lchamga qarab sifat tanlanadi: internet tejaladi
        dynacast: true,
        videoCaptureDefaults: { resolution: host ? VideoPresets.h720 : VideoPresets.h360 },
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      room = rm;
      holder = document.createElement("div");
      holder.hidden = true;
      document.body.appendChild(holder);
      rm.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) holder?.appendChild(track.attach()); roster(); })
        .on(RoomEvent.TrackUnsubscribed, (track) => { if (track.kind === Track.Kind.Audio) track.detach().forEach((el) => el.remove()); roster(); })
        .on(RoomEvent.ParticipantConnected, roster).on(RoomEvent.ParticipantDisconnected, roster)
        .on(RoomEvent.TrackPublished, roster).on(RoomEvent.TrackUnpublished, roster)
        .on(RoomEvent.TrackMuted, roster).on(RoomEvent.TrackUnmuted, roster)
        .on(RoomEvent.LocalTrackPublished, roster).on(RoomEvent.LocalTrackUnpublished, roster)
        .on(RoomEvent.ParticipantPermissionsChanged, roster)
        .on(RoomEvent.ActiveSpeakersChanged, roster)
        .on(RoomEvent.AudioPlaybackStatusChanged, () => emit({ type: "audio", blocked: !rm.canPlaybackAudio }))
        .on(RoomEvent.ConnectionStateChanged, (s) => {
          if (s === ConnectionState.Connected) emit({ type: "state", state: "live" });
          else if (s === ConnectionState.Reconnecting || s === ConnectionState.SignalReconnecting) emit({ type: "state", state: "reconnecting" });
        })
        .on(RoomEvent.Disconnected, () => emit({ type: "state", state: "ended" }))
        .on(RoomEvent.DataReceived, (payload, p, _kind, topic) => {
          if (topic === "voice") {
            if (p) emit({ type: "clip", from: { identity: p.identity, name: p.name || p.identity, host: roleOf(p.metadata) === "host" }, chunk: payload });
            return;
          }
          const msg = decodeMsg(payload, topic);
          if (!msg || !p || (topic !== "chat" && topic !== "hand")) return;
          emit({ type: "data", topic, from: { identity: p.identity, name: p.name || p.identity, host: roleOf(p.metadata) === "host" }, msg });
        });
      try {
        await rm.connect(d.url, d.token);
      } catch {
        holder.remove(); room = null;
        throw new VoiceError("Xonaga ulanib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.");
      }
      await rm.startAudio().catch(() => {});
      // Ustoz (yoki erkin suhbat) kirishda tanlangan holatda mikrofon/kamerani yoqadi; ruxsat berilmasa, jim o'tadi (tugma bilan keyin yoqiladi).
      if (d.canSpeak && o.prefs) {
        if (o.prefs.audio) await rm.localParticipant.setMicrophoneEnabled(true, o.prefs.micId ? { deviceId: o.prefs.micId } : undefined).catch(() => {});
        if (o.prefs.video) await rm.localParticipant.setCameraEnabled(true, o.prefs.camId ? { deviceId: o.prefs.camId } : undefined).catch(() => {});
      }
      emit({ type: "state", state: "live" });
      emit({ type: "audio", blocked: !rm.canPlaybackAudio });
      roster();
      return { identity: rm.localParticipant.identity, host, canSpeak: !!d.canSpeak };
    },
    disconnect() {
      room?.removeAllListeners();
      void room?.disconnect();
      room = null;
      holder?.remove(); holder = null;
    },
    async setMic(on, deviceId) { await room?.localParticipant.setMicrophoneEnabled(on, on && deviceId ? { deviceId } : undefined); roster(); },
    async setCam(on, deviceId) { await room?.localParticipant.setCameraEnabled(on, on && deviceId ? { deviceId } : undefined); roster(); },
    async setScreen(on) { await room?.localParticipant.setScreenShareEnabled(on); roster(); },
    attachVideo(identity, el, source) {
      const pub = find(identity)?.getTrackPublication(source === "screen" ? Track.Source.ScreenShare : Track.Source.Camera);
      const t = pub?.track;
      if (!t || t.kind !== Track.Kind.Video) return () => {};
      t.attach(el);
      return () => { t.detach(el); };
    },
    async send(topic, msg) { await room?.localParticipant.publishData(encodeMsg(msg), { reliable: true, topic }); },
    async sendClip(chunk) { await room?.localParticipant.publishData(chunk, { reliable: true, topic: "voice" }); },
    async startAudio() { await room?.startAudio(); emit({ type: "audio", blocked: !(room?.canPlaybackAudio ?? true) }); },
    on(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
