import { z } from "zod";

/** Zod xabarlari o'zbekcha: foydalanuvchi forma xatosini tushunishi uchun (sxemada o'z matni berilgan bo'lsa, o'sha ishlatiladi). */
z.config({
  customError: (iss) => {
    const n = (iss as { minimum?: number | bigint; maximum?: number | bigint }).minimum ?? (iss as { maximum?: number | bigint }).maximum;
    const origin = (iss as { origin?: string }).origin;
    const unit = origin === "string" ? "belgi" : origin === "array" || origin === "set" ? "ta element" : "";
    switch (iss.code) {
      case "invalid_type": return "Qiymat noto'g'ri turda yoki kiritilmagan.";
      case "too_small": return origin === "string" || origin === "array" ? `Kamida ${String(n)} ${unit} bo'lishi kerak.` : `Qiymat ${String(n)} dan kam bo'lmasligi kerak.`;
      case "too_big": return origin === "string" || origin === "array" ? `Ko'pi bilan ${String(n)} ${unit} bo'lishi mumkin.` : `Qiymat ${String(n)} dan oshmasligi kerak.`;
      case "invalid_format": return "Format noto'g'ri.";
      case "invalid_value": return "Ruxsat etilmagan qiymat tanlangan.";
      default: return undefined;
    }
  },
});

export {};
