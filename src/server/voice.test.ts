import { describe, expect, it } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import { authorize, httpUrl, issueToken, voiceConfig, wsUrl } from "./voice";
import { signRoom } from "./voicelogic";

const AUTH = "a".repeat(40);
const env = { LIVEKIT_URL: "wss://demo.livekit.cloud", LIVEKIT_API_KEY: "APIkey123", LIVEKIT_API_SECRET: "s".repeat(40), AUTH_SECRET: AUTH } as unknown as NodeJS.ProcessEnv;
const code = "abcdefghjk";

describe("sozlama", () => {
  it("hamma kalit bo'lsa yoqiladi, bittasi yetishmasa o'chiq", () => {
    expect(voiceConfig(env)).not.toBeNull();
    for (const k of ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "AUTH_SECRET"]) expect(voiceConfig({ ...env, [k]: "" } as NodeJS.ProcessEnv)).toBeNull();
    expect(voiceConfig({ ...env, AUTH_SECRET: "qisqa" } as NodeJS.ProcessEnv)).toBeNull();
  });
  it("manzil shakllari", () => {
    expect(wsUrl("https://a.livekit.cloud/")).toBe("wss://a.livekit.cloud");
    expect(wsUrl("wss://a.livekit.cloud")).toBe("wss://a.livekit.cloud");
    expect(httpUrl("wss://a.livekit.cloud/")).toBe("https://a.livekit.cloud");
  });
});

describe("kirish belgisi (token)", () => {
  const withEnv = async <T,>(fn: () => Promise<T>) => {
    const old = { ...process.env };
    Object.assign(process.env, env);
    try { return await fn(); } finally { for (const k of Object.keys(env)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
  };
  const verify = (t: string) => new TokenVerifier(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!).verify(t);

  it("o'quvchi tokeni: faqat eshitadi, ustoz huquqi yo'q", async () => {
    const { k } = signRoom(AUTH, code, "s");
    const r = await withEnv(() => issueToken({ code, mode: "s", k, name: "Ali" }));
    expect(r.role).toBe("guest"); expect(r.canSpeak).toBe(false); expect(r.url).toBe("wss://demo.livekit.cloud"); expect(r.identity.startsWith("o-")).toBe(true);
    const c = await verify(r.token);
    expect(c.video).toMatchObject({ roomJoin: true, room: "u360-abcdefghjk", canPublish: false, canSubscribe: true });
    expect(c.video?.roomAdmin).toBeFalsy();
    expect(c.name).toBe("Ali");
  });
  it("ustoz tokeni: boshqaruv huquqi bor", async () => {
    const { k, h } = signRoom(AUTH, code, "s");
    const r = await withEnv(() => issueToken({ code, mode: "s", k, h, name: "Dilnoza" }));
    expect(r.role).toBe("host"); expect(r.canSpeak).toBe(true); expect(r.identity.startsWith("t-")).toBe(true);
    expect((await verify(r.token)).video).toMatchObject({ roomAdmin: true, canPublish: true });
  });
  it("erkin suhbatda o'quvchi gapira oladi", async () => {
    const { k } = signRoom(AUTH, code, "e");
    const r = await withEnv(() => issueToken({ code, mode: "e", k }));
    expect(r.canSpeak).toBe(true);
    expect((await verify(r.token)).name).toBe("Mehmon");
  });
  it("yaroqsiz imzo bilan token berilmaydi", async () => {
    const { k } = signRoom(AUTH, code, "s");
    await expect(withEnv(() => issueToken({ code, mode: "e", k }))).rejects.toMatchObject({ status: 403 });
    await expect(withEnv(() => issueToken({ code, mode: "s", k: "x".repeat(22) }))).rejects.toMatchObject({ status: 403 });
  });
  it("sozlanmagan bo'lsa 503", async () => {
    const { k } = signRoom(AUTH, code, "s");
    const saved = process.env.LIVEKIT_URL; delete process.env.LIVEKIT_URL;
    try { await expect(issueToken({ code, mode: "s", k })).rejects.toMatchObject({ status: 503 }); } finally { if (saved !== undefined) process.env.LIVEKIT_URL = saved; }
  });
  it("ustoz bo'lmagan imzo boshqaruvga ruxsat bermaydi", () => {
    const c = voiceConfig(env)!; const { k, h } = signRoom(AUTH, code, "s");
    expect(authorize(c, { code, mode: "s", k })).toBe("guest");
    expect(authorize(c, { code, mode: "s", k, h })).toBe("host");
  });
});
