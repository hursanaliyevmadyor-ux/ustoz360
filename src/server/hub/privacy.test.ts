import { describe, expect, it } from "vitest";
import { findPii, hasPii, scrubPii } from "./privacy";

describe("shaxsiy ma'lumotni topish va tozalash", () => {
  it("telefon raqamlarini topadi va niqoblaydi", () => {
    const r = scrubPii("Menga +998 90 123 45 67 ga yozing yoki 90-123-45-67 ga qo'ng'iroq qiling");
    expect(r.text).toBe("Menga [telefon] ga yozing yoki [telefon] ga qo'ng'iroq qiling");
    expect(r.found).toEqual(["phone"]);
    expect(findPii("998901234567")).toContain("phone");
    expect(findPii("+14155552671")).toContain("phone");
  });

  it("email, karta, PINFL, pasport va Telegram @nom", () => {
    expect(scrubPii("ali.valiyev@mail.uz").text).toBe("[email]");
    expect(scrubPii("karta 8600 1234 5678 9012").text).toBe("karta [karta]");
    expect(scrubPii("PINFL 12345678901234").text).toBe("PINFL [pinfl]");
    expect(scrubPii("pasport AA1234567").text).toBe("pasport [pasport]");
    expect(scrubPii("yozing @ustoz_ali").text).toBe("yozing [@nom]");
    // email ichidagi @ alohida @nom deb sanalmaydi
    expect(scrubPii("ali@mail.uz").found).toEqual(["email"]);
  });

  it("API kalit va tokenlarni niqoblaydi (havoladagi ?key= ham)", () => {
    expect(scrubPii("kalit AIzaSyA1234567890abcdefghijKLMNOP").found).toContain("secret");
    expect(scrubPii("tvly-abcdefghijklmnop123").text).toBe("[kalit]");
    expect(scrubPii("https://x.uz/api?key=abc123secret&q=1").text).toBe("https://x.uz/api?key=[kalit]&q=1");
    expect(scrubPii("Authorization: Bearer abcdefghijklmnopqrstuv").found).toContain("secret");
  });

  it("oddiy ta'lim savollari (raqamli misollar ham) shaxsiy deb sanalmaydi", () => {
    for (const q of [
      "7 sinf matematika: 123456789 ni 987654321 ga ko'paytiring",
      "2026-yil attestatsiya muddatlari qachon?",
      "Kasrlarni qo'shish qoidasi nima? 3/4 + 1/8",
      "Fotosintez jarayonini 5-sinfga qanday tushuntiraman",
    ]) { expect(hasPii(q), q).toBe(false); expect(scrubPii(q).text).toBe(q); }
  });

  it("qayta chaqirilganda holat saqlanmaydi (global regex xatosi yo'q)", () => {
    for (let i = 0; i < 4; i++) expect(findPii("tel +998901234567")).toEqual(["phone"]);
    expect(scrubPii("a@b.uz").text).toBe("[email]");
    expect(scrubPii("a@b.uz").text).toBe("[email]");
  });
});
