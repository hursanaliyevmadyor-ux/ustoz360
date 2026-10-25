/** «Ulanishni sinash» natijasidagi xato kodining tushunarli izohi (admin nima qilish kerakligini ko'radi). Toza funksiya. */
export function healthHint(code?: string | null): string {
  if (!code) return "";
  if (code === "404") return "model nomi topilmadi (eskirgan bo'lishi mumkin): muhitdagi model nomini yangilang";
  if (code === "429") return "limit yoki kvota tugagan: birozdan so'ng qayta sinang yoki boshqa model/kalit qo'shing";
  if (code === "401" || code === "403") return "kalit noto'g'ri yoki ruxsat yo'q: kalitni tekshiring";
  if (code === "400") return "so'rov rad etildi: model nomi yoki sozlamani tekshiring";
  if (/^5\d\d$/.test(code)) return "xizmat band yoki vaqtincha ishlamayapti";
  if (code === "TimeoutError" || code === "AbortError") return "javob kechikdi";
  return "";
}
