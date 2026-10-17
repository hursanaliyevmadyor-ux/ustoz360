# USTOZ 360: yakunlash hisoboti

Asos: audit ([AUDIT.md](AUDIT.md)), ish tarmog'i: `feat/platforma-yakunlash` (GitHub `main` o'zgartirilmagan, birlashtirish foydalanuvchi ruxsatidan keyin).

## 1. Bo'limlar holati

| BO'LIM | AVVALGI HOLAT | QILINGAN ISH | HOZIRGI HOLAT | TEST NATIJASI |
|---|---|---|---|---|
| Umumiy xizmatlar | yo'q | Sozlamalar (`SiteSetting`), bildirishnoma, tarif/huquqlar (entitlement), to'lov xizmati, audit, fayl saqlash interfeysi | READY | birlik testlari + E2E |
| Admin panel | DEMO (soxta raqamlar) | Dashboard (haqiqiy), foydalanuvchilar (qidiruv, rol, bloklash, tarif), kurslar tasdig'i, to'lovlar, kutubxona moderatsiyasi, rasmiy ma'lumotlar, hisobotlar (CSV), sozlamalar (modullar, AI, to'lov, ulanishlar holati) | READY | E2E: himoya, rol, CSV, statistika |
| Yon menyu/panel | soxta foydalanuvchi, demo bildirishnoma | Haqiqiy profil, bildirishnomalar, modul yoqish/o'chirish, chiqish; nom «USTOZ 360» | READY | 320px da tekshirilgan |
| DARSYOR | toast va brauzer ichida | Dars ishlanmasi (AI/qo'lda, saqlash, qoralama, tarix, .txt/Word/chop etish), topshiriq generatori (8 tur, AI qoralamasi tasdiqsiz o'quvchi varag'iga kirmaydi), 7 ko'rgazma shabloni (saqlash, SVG/Word/chop etish), rubrika va kuzatuv varaqasi (server), fikr-mulohaza shabloni | READY (AI ulanmagan bo'lsa qo'lda ishlaydi) | 12 birlik testi + E2E (hujjatlar, egasi tekshiruvi) |
| TOIFA | DEMO | Maqsad profildan, qoidali reja (diagnostika/natija/xatolar), kalendar (reja, seminar, imtihon, rasmiy sanalar), real yo'l xaritasi, shaxsiy cheklist, admin kiritadigan rasmiy ma'lumot (tekshirilgan/tekshirilmagan) | READY | 16 birlik testi + E2E |
| SINF | DEMO | Sinflar, taxallusli o'quvchilar, baholash va ball kiritish/tahrirlash, mavzu tahlili, oldin/keyin taqqoslash, kam ma'lumot ogohlantirishi, DARSYOR'ga mavzu bilan o'tish | READY | 14 birlik testi + E2E |
| MARKET | DEMO | Katalog (faqat tasdiqlangan), muallif kabineti (qoralama, tekshiruv), admin tasdig'i, buyurtma, to'lov tasdig'idan keyin kirish, qaytarish, idempotent webhook | READY (bank o'tkazmasi); provayder BLOCKED | 17 birlik testi (+ 30 umumiy xizmat testi) + E2E |
| BILIMXONA | DEMO | Server tekshiruvi (tur, tarkib, hajm), kutubxona (qidiruv, filtr, sevimli, ommaviy qilish so'rovi), TXT/DOCX matnini bo'laklash, hujjat ichidan manbali javob | PARTIAL: saqlash xizmati BLOCKED | 20 birlik testi (soxta saqlash bilan) |
| AI qatlami | kunlik limit, jurnal | Tarif limiti, daqiqalik limit, qayta urinish, kechikish/narx/prompt versiyasi jurnali, tuzilmali javob (Zod), sog'liq tekshiruvi, admin boshqaruvi va sarf hisoboti | READY; AI kaliti BLOCKED | 13 yangi birlik testi |
| Dashboard | qisman haqiqiy | Reja bandlari, yaqin seminarlar, davom ettirilmagan mashq, obuna va kurslar holati, admin boshqaradigan yangiliklar va e'lonlar (Sozlamalar → E'lonlar), "reja tuzing" tavsiyasi, namuna rejimi aniq belgilanadi | READY | 3 birlik testi + brauzerda tekshirilgan |
| Obuna/profil | DEMO | Haqiqiy tariflar, buyurtma, to'lov tarixi, profilda tarif va kurslar | READY | E2E |

## 2. Qo'llanishi kerak bo'lgan baza o'zgarishlari (faqat qo'shimcha)
- `prisma/supabase-update-platform.sql` (migratsiya `20261022100000_platform`): 18 yangi jadval, `AiRequest` ga 3 ustun, hamma yangi jadvalda RLS yoqilgan.
- `prisma/supabase-update-course-url.sql` (migratsiya `20261022110000_course_url`): `Course.accessUrl`.
- Haqiqiy bazada qo'llangan va tekshirilgan (`prisma/check-db.ts`): `npx tsx --env-file=.env.local prisma/check-db.ts`. Hech narsa o'chirilmagan.

## 3. Yangi API
Foydalanuvchi: `/api/settings/public`, `/api/notifications`, `/api/market/{catalog,order,orders/[id],purchases,author,author/[id],author/[id]/submit,author-request}`, `/api/payments/webhook`, `/api/docs`, `/api/docs/[id]`, `/api/ai/taskset`, `/api/toifa`, `/api/toifa/plan`, `/api/toifa/plan/[id]`, `/api/toifa/checklist`, `/api/toifa/checklist/[id]`, `/api/sinf` (+ `[id]`, `students`, `assessments`, `scores`), `/api/library` (+ `[id]`, `download`, `favorite`, `publish`, `ask`).
Admin: `/api/admin/{stats,users,users/[id],courses,courses/[id],payments,payments/[id],reports,audit,settings,ai/test,ai/usage,official,official/[id],library,library/[id]}`.
O'zgargan: `/api/me` (tarif), `/api/ai/lesson` (yagona AI kirish nuqtasi), `/api/dashboard` (reja va seminarlar).

## 4. Tashqi xizmatlar va nima kerak
| Xizmat | Holat | Kerak |
|---|---|---|
| AI (Claude yoki bepul OpenAI-mos xizmat) | BLOCKED: kalit yo'q | `ANTHROPIC_API_KEY` yoki `FREE_LLM_BASE_URL`, `FREE_LLM_API_KEY`, `FREE_LLM_MODEL` (OpenRouter uchun `:free` model nomi). Keyin Admin → Sozlamalar → AI → «Ulanishni sinash» |
| Fayl saqlash | BLOCKED | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (faqat serverda), ixtiyoriy `SUPABASE_STORAGE_BUCKET` (shaxsiy bucket o'zi yaratiladi) |
| To'lov provayderi | BLOCKED | Click/Payme shartnomasi va kalitlari. Tayyor umumiy webhook: `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_CHECKOUT_URL`. Hozir «Bank o'tkazmasi» (admin tasdiqlaydi): Admin → Sozlamalar → To'lov |
| Email (SMTP) | BLOCKED | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Telegram, Yandex | sozlanmagan | `.env.example`ga qarang |

Kalitlar bazada saqlanmaydi va admin sahifasida ko'rsatilmaydi: faqat «ulangan/ulanmagan».

## 5. Test natijalari
- `npm run lint` (`tsc --noEmit`): xatosiz. `npm test`: 22 fayl, 308 test o'tdi. `npm run build`: o'tdi.
- `npm run test:e2e:platform`: 9 blok o'tdi (himoya va rollar, MARKET/to'lov oqimi, tarif va AI limiti, DARSYOR, TOIFA, SINF, BILIMXONA, admin). Haqiqiy baza va sinov foydalanuvchilari bilan, so'ng o'chirilgan.
- Brauzer: 320 va 375 px da gorizontal siljish yo'q (barcha asosiy sahifalar). Topilgan va tuzatilgan: sarlavha 320 px da toshishi, jadvaldagi yashirin matn sahifani kengaytirishi, kartochka sarlavhasi.

## 6. Xavfsizlik tekshiruvi
- Har bir admin API'da `requireAdmin`; oddiy foydalanuvchi 403 oladi (E2E).
- Foydalanuvchi ma'lumoti faqat egasiga: hujjat, sinf, kutubxona, reja (boshqa foydalanuvchi 404).
- Narx va summa doim serverda bazadan; kirish faqat `PAID` dan keyin; webhook HMAC imzo + summa tekshiruvi + takroriy xabar xavfsiz.
- O'z rolini o'zgartirib bo'lmaydi; oxirgi administratorni olib tashlab bo'lmaydi; bosh administrator faqat bosh administrator tomonidan.
- Fayl: kengaytma va haqiqiy tarkib (magic bytes), hajm, nom tozalanadi, shaxsiy bucket, 5 daqiqalik imzolangan havola.
- O'quvchi ismi/telefoni/emaili saqlanmaydi (taxallus tekshiruvi). CSV'da formula xavfi bartaraf etilgan.
- Hech qanday maxfiy kalit repo yoki bazaga yozilmagan.

## 7. Ishlab chiqarishga tayyorlik
Kod va baza tayyor. Ishlatishdan oldin: (1) GitHub'da PR'ni ko'rib chiqish va birlashtirish (foydalanuvchi qarori), (2) hosting'da kerakli muhit o'zgaruvchilari, (3) AI kaliti va savollar bazasini haqiqiy savollar bilan to'ldirish (hozir 39 ta namunaviy savol), (4) to'lov provayderi bilan shartnoma, (5) rasmiy ma'lumotlarni admin orqali manba bilan kiritish.
