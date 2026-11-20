import { ConnectionState, Room, RoomEvent, Track, type Participant } from "livekit-client";
import { decodeMsg, encodeMsg, roleOf, type VoiceMsg, type VoiceTopic } from "@/lib/voice-msg";

/**
 * Ovozli xonaning LiveKit bilan ishlaydigan qatlami. Ekran (voice-room.tsx) faqat shu oddiy interfeysni biladi:
 * keyinroq LiveKit o'rniga boshqa xizmat qo'yilsa, ekran o'zgarmaydi; sinovda soxta engine beriladi.
 */
export type VPerson = { identity: string; name: string; host: boolean; speaking: boolean; micOn: boolean; canSpeak: boolean; me: boolean };
export type VState = "connecting" | "live" | "reconnecting" | "ended";
export type VEvent =
  | { type: "roster"; people: VPerson[] }
  | { type: "data"; topic: VoiceTopic; from: { identity: string; name: string; host: boolean }; msg: VoiceMsg }
  | { type: "state"; state: VState; reason?: string }
  | { type: "audio"; blocked: boolean };
export type VSession = { identity: string; host: boolean; canSpeak: boolean };
export type VEngine = {
  connect(): Promise<VSession>;
  disconnect(): void;
  setMic(on: boolean): Promise<void>;
  send(topic: VoiceTopic, msg: VoiceMsg): Promise<void>;
  startAudio(): Promise<void>;
  on(fn: (e: VEvent) => void): () => void;
};

export class VoiceError extends Error {}

const ERRORS: Record<string, string> = {
  voice_off: "Ovozli xona hozircha ishlamayapti.",
  bad_link: "Havola noto'g'ri yoki eskirgan. Ustozdan yangi havola so'rang.",
};

export function createLiveKitEngine(o: { code: string; mode: "s" | "e"; k: string; h?: string; name: string }): VEngine {
  let room: Room | null = null;
  let holder: HTMLDivElement | null = null;
  const subs = new Set<(e: VEvent) => void>();
  const emit = (e: VEvent) => subs.forEach((f) => f(e));

  const person = (p: Participant, me: boolean): VPerson => ({
    identity: p.identity, name: p.name || p.identity, host: roleOf(p.metadata) === "host",
    speaking: p.isSpeaking, micOn: p.isMicrophoneEnabled, canSpeak: !!p.permissions?.canPublish, me,
  });
  const roster = () => {
    if (!room) return;
    emit({ type: "roster", people: [person(room.localParticipant, true), ...[...room.remoteParticipants.values()].map((p) => person(p, false))] });
  };

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
      const rm = new Room({ audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      room = rm;
      holder = document.createElement("div");
      holder.hidden = true;
      document.body.appendChild(holder);
      rm.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) holder?.appendChild(track.attach()); })
        .on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((el) => el.remove()); })
        .on(RoomEvent.ParticipantConnected, roster).on(RoomEvent.ParticipantDisconnected, roster)
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
      emit({ type: "state", state: "live" });
      emit({ type: "audio", blocked: !rm.canPlaybackAudio });
      roster();
      return { identity: rm.localParticipant.identity, host: d.role === "host", canSpeak: !!d.canSpeak };
    },
    disconnect() {
      room?.removeAllListeners();
      void room?.disconnect();
      room = null;
      holder?.remove(); holder = null;
    },
    async setMic(on) { await room?.localParticipant.setMicrophoneEnabled(on); roster(); },
    async send(topic, msg) { await room?.localParticipant.publishData(encodeMsg(msg), { reliable: true, topic }); },
    async startAudio() { await room?.startAudio(); emit({ type: "audio", blocked: !(room?.canPlaybackAudio ?? true) }); },
    on(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
