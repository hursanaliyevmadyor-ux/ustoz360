import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMBED_DIMS, embed, embeddingVersion, embeddingsConfigured, validVector, vectorLiteral } from "./embeddings";

const vec = (n = EMBED_DIMS) => Array.from({ length: n }, (_, i) => i / 1000);

describe("embedding yordamchilari", () => {
  it("vektor tekshiruvi: faqat 768 ta chekli son", () => {
    expect(validVector(vec())).toBe(true);
    expect(validVector(vec(10))).toBe(false);
    expect(validVector([...vec(EMBED_DIMS - 1), NaN])).toBe(false);
    expect(validVector("x")).toBe(false);
  });
  it("pgvector matn ko'rinishi", () => { expect(vectorLiteral([0.1, 0.123456789, 2])).toBe("[0.1,0.123457,2]"); });
  it("model versiyasi o'lchamni o'z ichiga oladi", () => { expect(embeddingVersion()).toMatch(/@768$/); });
});

describe("embed() so'rovi", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); process.env.GEMINI_API_KEY = "test-key"; delete process.env.KNOWLEDGE_EMBEDDINGS; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; });

  it("kalit yo'q yoki o'chirilgan bo'lsa tarmoqqa chiqmaydi", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(embeddingsConfigured()).toBe(false);
    expect(await embed("savol", "RETRIEVAL_QUERY")).toBeNull();
    process.env.GEMINI_API_KEY = "k"; process.env.KNOWLEDGE_EMBEDDINGS = "off";
    expect(await embed("savol", "RETRIEVAL_QUERY")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("kalit sarlavhada (manzilda emas), o'lcham va vazifa turi bilan so'raydi", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ embedding: { values: vec() } }) });
    expect(await embed("  kasrlarni   qo'shish ", "RETRIEVAL_DOCUMENT")).toHaveLength(EMBED_DIMS);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(":embedContent");
    expect(String(url)).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768, content: { parts: [{ text: "kasrlarni qo'shish" }] } });
  });
  it("xizmat xato bersa, noto'g'ri o'lchamli yoki tarmoq uzilsa null (xato tashlanmaydi)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    expect(await embed("savol", "RETRIEVAL_QUERY")).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: { values: vec(5) } }) });
    expect(await embed("savol", "RETRIEVAL_QUERY")).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("tarmoq"));
    expect(await embed("savol", "RETRIEVAL_QUERY")).toBeNull();
    expect(await embed("   ", "RETRIEVAL_QUERY")).toBeNull();
  });
});
