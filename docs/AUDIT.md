# USTOZ 360: audit (1-bosqich)

Sana: 2026-10-17. Asos: GitHub `main` (`cddc930`, o'zgarmagan), mahalliy ishchi nusxa, haqiqiy Supabase bazasi (faqat o'qildi).

## Baseline
| Tekshiruv | Natija |
|---|---|
| `npm test` | 15 fayl, 183 test o'tdi |
| `npm run lint` (`tsc --noEmit`) | xatosiz |
| Baza va Prisma sxemasi (`prisma/check-db.ts`) | 24/24 jadval, yetishmayotgan ustun va enum yo'q, ortiqcha jadval yo'q |
| Bazadagi ma'lumot | 3 foydalanuvchi (1 admin), 1 fan, 5 mavzu, 39 savol (hammasi "namunaviy"), 4 imtihon, 0 seminar |
| AI | `ANTHROPIC_API_KEY` va `FREE_LLM_*` ishlaydigan qiymatsiz: `/api/ai/status` ikkalasini ham "sozlanmagan" deydi |
| Storage / to'lov | `SUPABASE_URL`, service role kaliti, Click/Payme kalitlari yo'q |

## Holat jadvali
READY: ishlaydi va bazaga ulangan. PARTIAL: qisman. DEMO: namunaviy ma'lumot, saqlamaydi. BLOCKED: tashqi kalit/xizmat kerak.

| Bo'lim | Holat | Izoh |
|---|---|---|
| Kirish (Google, Yandex, Telegram, email), sessiya, rollar | READY | `requireUser`, `requireAdmin`, `requireVerified` |
| Profil, onboarding, `/api/profile` | READY | imtihon turi, sana, kunlik vaqt saqlanadi |
| Diagnostika, Testlar 2.0 (8 rejim), Bilim laboratoriyasi, bilim xaritasi, xatolar | READY | 183 test; savollar bazasi kichik (namunaviy) |
| Imtihon simulyatori, seminarlar | READY | admin orqali boshqariladi |
| Admin: imtihonlar, mavzular, savollar banki, seminarlar | READY | |
| `/ai` chat (saqlanadigan chatlar), bepul chat | PARTIAL | kod tayyor, AI kaliti yo'q (BLOCKED) |
| Dashboard | PARTIAL | kirgan foydalanuvchiga haqiqiy; kirmaganga "namunani ko'rish" |
| Yon menyu / yuqori panel | PARTIAL | profil bloki yuklanguncha soxta "Dilnoza Karimova, PRO" ko'rsatadi; bildirishnomalar DEMO; nom hali EDUTECHALL |
| DARSYOR: dars ishlanmasi | PARTIAL | AI endpoint bor, ishlanma saqlanmaydi, faqat `.txt` |
| DARSYOR: baholash | PARTIAL | rubrika brauzerda, CSV; kuzatuv varaqasi yo'q |
| DARSYOR: test generatori, ko'rgazmali materiallar | DEMO | tugma toast ko'rsatadi |
| TOIFA: reja, kalendar, hujjatlar | DEMO | `lib/demo`; soxta sanalar |
| MARKET: katalog, kurslarim, muallif kabineti | DEMO | "Sotib olish" toast; to'lov yo'q |
| SINF: sinflar, tahlil, natijalar | DEMO | |
| BILIMXONA: kutubxona, yuklash, suhbat | DEMO | fayl yuklanmaydi |
| Obuna | DEMO | tariflar kodda, "Tanlash" toast |
| Admin: dashboard, foydalanuvchilar, kurslar, to'lovlar, hisobotlar, sozlamalar | DEMO | soxta raqamlar (1 284 foydalanuvchi, 12 845 000 daromad) |
| AI shlyuzi | PARTIAL | kunlik limit, jurnal bor; retry, daqiqalik limit, health, xarajat, prompt versiyasi yo'q |
| To'lov (Click/Payme) | BLOCKED | provayder kalitlari va shartnoma kerak |
| Fayl saqlash (Supabase Storage) | BLOCKED | `SUPABASE_URL` va service role kaliti kerak |

## Toast-only tugmalar (`toast("info", ...)`)
Rejani yangilash, Yaratish (test generatori), Ochish (ko'rgazma), Saqlash (admin sozlamalari), Yuklash (BILIMXONA), Qo'shish (admin foydalanuvchi), Tanlash (obuna), Sotib olish (MARKET), Tekshiruvga yuborish (muallif), Saqlash (demo profil), Saqlash (SINF). Hammasi keyingi bosqichlarda haqiqiy amalga o'tkaziladi yoki halol "ulanmagan" holatiga o'tadi.

## `lib/demo` ishlatilgan joylar
dashboard demo, profil demo, xatolar demo, bilim xaritasi demo, local diagnostika, app-shell (bildirishnoma, foydalanuvchi), TOIFA, MARKET, SINF, BILIMXONA, admin sahifalari.

## Yakuniy holat
Bu auditdan keyin DEMO bo'lgan hamma bo'lim haqiqiy ma'lumotga ulandi; tashqi kalit kerak bo'lganlari (AI, fayl saqlash, to'lov provayderi, SMTP) BLOCKED holatida halol xabar bilan turadi. Natijalar va nima kerakligi: [PLATFORMA.md](PLATFORMA.md).

## Qoidalar (saqlanadi)
Ishlayotgan hech narsa qayta yozilmaydi: yon menyu, yo'l ko'rsatkichi, Testlar 2.0, Bilim laboratoriyasi, imtihon, seminarlar, admin savollar banki, eski manzillar yo'naltirishi.

