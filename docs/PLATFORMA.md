# USTOZ 360: yakunlash hisoboti

Asos: audit ([AUDIT.md](AUDIT.md)). Platforma `main`ga birlashtirilgan (PR #13). Alohida admin sayti: ish tarmog'i `feat/admin-sayt` (8-bo'limga qarang); `main` foydalanuvchi ruxsatisiz o'zgartirilmaydi.

## 1. Bo'limlar holati

| BO'LIM | AVVALGI HOLAT | QILINGAN ISH | HOZIRGI HOLAT | TEST NATIJASI |
|---|---|---|---|---|
| Umumiy xizmatlar | yo'q | Sozlamalar (`SiteSetting`), bildirishnoma, tarif/huquqlar (entitlement), to'lov xizmati, audit, fayl saqlash interfeysi | READY | birlik testlari + E2E |
| Admin panel | DEMO (soxta raqamlar) | Alohida admin sayti (o'z menyu va yuqori paneli), dashboard (haqiqiy), yo'nalishlar bo'yicha statistika, foydalanuvchilar (qidiruv, rol, bloklash, tarif), kurslar tasdig'i, to'lovlar, kutubxona moderatsiyasi, rasmiy ma'lumotlar, hisobotlar (CSV), audit jurnali, e'lonlar, modullar, sozlamalar (AI, to'lov, ulanishlar holati) | READY | E2E: himoya, rol, CSV, statistika |
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
Admin: `/api/admin/{stats,stats/section,users,users/[id],courses,courses/[id],payments,payments/[id],reports,audit,settings,ai/test,ai/usage,official,official/[id],library,library/[id]}`.
O'zgargan: `/api/me` (tarif), `/api/ai/lesson` (yagona AI kirish nuqtasi), `/api/dashboard` (reja va seminarlar).

## 4. Tashqi xizmatlar va nima kerak
| Xizmat | Holat | Kerak |
|---|---|---|
| AI (Claude yoki bepul OpenAI-mos xizmat) | BLOCKED: kalit yo'q | `ANTHROPIC_API_KEY` yoki `FREE_LLM_BASE_URL`, `FREE_LLM_API_KEY`, `FREE_LLM_MODEL` (OpenRouter uchun `:free` model nomi; zaxira uchun `FREE_LLM2_*` ... `FREE_LLM10_*`). Keyin Admin → Sozlamalar → AI → «Ulanishni sinash» |
| Internet qidiruvi (Tavily, zaxirada Gemini) | Kod tayyor; kalit yo'q | `TAVILY_API_KEY` (bepul oyiga 1000 kredit), ixtiyoriy `GEMINI_API_KEY`. Oqim, limitlar va admin ko'rsatkichlari: [INTERNET-QIDIRUV.md](INTERNET-QIDIRUV.md). Baza: `prisma/supabase-update-web-cache.sql` (qo'llangan) |
| Fayl saqlash | BLOCKED | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (faqat serverda), ixtiyoriy `SUPABASE_STORAGE_BUCKET` (shaxsiy bucket o'zi yaratiladi) |
| To'lov provayderi | BLOCKED | Click/Payme shartnomasi va kalitlari. Tayyor umumiy webhook: `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_CHECKOUT_URL`. Hozir «Bank o'tkazmasi» (admin tasdiqlaydi): Admin → Sozlamalar → To'lov |
| Email (SMTP) | BLOCKED | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Telegram bot (kirish, to'liq menyu, AI) | READY: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` ulangan, webhook sayt o'zi o'rnatadi. Hamma bo'lim botda ([BOT.md](BOT.md)). Kunlik eslatma uchun `CRON_SECRET` kerak | Sinash: botga `/start` |
| Yandex | sozlanmagan | `.env.example`ga qarang |

Kalitlar bazada saqlanmaydi va admin sahifasida ko'rsatilmaydi: faqat «ulangan/ulanmagan».

## 5. Test natijalari
- `npm run lint` (`tsc --noEmit`): xatosiz. `npm test`: 45 fayl, 595 test o'tdi. `npm run build`: o'tdi.
- `npm run test:e2e:platform`: 10 blok o'tdi (himoya va rollar, MARKET/to'lov oqimi, tarif va AI limiti, DARSYOR, TOIFA, SINF, BILIMXONA, admin statistikasi, admin hisobot/qidiruv). Haqiqiy baza va sinov foydalanuvchilari bilan, so'ng o'chirilgan.
- `npm run test:e2e:bot`: 13 blok o'tdi (bot menyusi, testlar, TOIFA, SINF, DARSYOR, AI, kurslar, kutubxona, profil, kunlik eslatma, ro'yxatdan o'tish, Mini App kirishi). Mini App brauzerda haqiqiy Telegram skripti bilan ham sinalgan: avtomatik kirish, noto'g'ri imzoni rad etish, oddiy brauzerga ta'sir qilmasligi. Haqiqiy baza va soxta Telegram serveri bilan; Telegram talablari (HTML, 4096 belgi, `callback_data`) ham tekshiriladi. Sinov foydalanuvchilari oxirida o'chiriladi.
- `npm run test:e2e:websearch`: 9 blok o'tdi (internet qidiruvi: bilim bazasi birinchi, rasmiy domenlar, ishonchlilik, qat'iy javob, tayyor material yaratilmasligi, kesh, limitlar, admin ko'rsatkichlari). Haqiqiy baza va soxta Tavily serveri bilan, kredit sarflanmaydi.
- `npm run test:e2e:knowledge`: 19 blok o'tdi, shu jumladan «yagona manba» (DARSYOR ham bilimni oladi) (AI Bilim markazi: faqat tasdiqlangan va muddati o'tmagan bilim javobga chiqishi, off/shadow/on, maxfiylik niqobi, rozilik va nomzod oqimi, tasdiq/rad/arxiv/xato belgisi, audit jurnali o'zgarmasligi, baholash, provayder rollari, shaxssiz statistika). Haqiqiy baza va soxta AI serveri bilan; vektor bloki ixtiyoriy (`E2E_VECTOR=1`) va hali ishga tushirilmagan. Admin sahifasi 375 px da gorizontal siljishsiz.
- Brauzer: 320 va 375 px da gorizontal siljish yo'q (asosiy sahifalar va barcha yangi admin sahifalari). Topilgan va tuzatilgan: sarlavha 320 px da toshishi, jadvaldagi yashirin matn sahifani kengaytirishi, kartochka sarlavhasi, diagramma yorliqlari kaliti takrorlanishi, admin belgisi yorug' fonda ko'rinmasligi.

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

## 8. Admin sayti (alohida ko'rinish)
- **Kim kiradi:** faqat `ADMIN`/`SUPERADMIN` roli. Bosh administrator: `hursanaliyevmadyor@gmail.com` (`prisma/make-admin.ts --super`). Qolganlarga rolni Admin → Foydalanuvchilar orqali bosh administrator beradi. Haqiqiy ruxsat har doim serverda (`requireAdmin`); brauzerdagi tekshiruv faqat qulaylik uchun.
- **Ko'rinish:** admin kirganda ustoz bo'limi (dashboard, USTOZ AI, sinflar, hujjatlar...) ko'rinmaydi; o'z menyusi va yuqori paneli bor alohida sayt ochiladi (`AdminShell`, menyu: `src/lib/admin-nav.ts`: Boshqaruv, Foydalanuvchilar, Kontent, AI Bilim markazi, Savdo, Tizim). Ustoz yo'llariga kirsa, `/admin`ga qaytariladi.
- **Ustoz ko'rinishi:** yuqoridagi menyudan almashtiriladi (tanlov brauzerda `u360-view` da saqlanadi). Bu ko'rinishda har sahifa tepasida admin paneli (`AdminBar`) chiqadi: shu bo'limni boshqarish havolasi va tezkor yangilik/e'lon qo'shish. Admin shaxsiy sinf, taxallus, ball, saqlangan hujjat va AI suhbatlarni ko'rmaydi: faqat yig'ma statistika va kontent.
- **Statistika** (`/admin/statistika`, davr: 7/30/90 kun): Ustozlar, Adminlar, USTOZ AI, DARSYOR, TOIFA, SINF, MARKET, BILIMXONA, AI, Seminarlar. Har bo'lim alohida so'raladi (`/api/admin/stats/section?name=...&days=...`, mantiq `src/server/adminsections.ts`). Faqat sonlar va umumiy jadvallar chiqadi; bitta ustozning shaxsiy ma'lumoti chiqmaydi (E2E tekshiradi).
- **Yangi admin sahifalari:** `/admin/statistika`, `/admin/audit` (admin va to'lov amallari jurnali), `/admin/elonlar` (yangilik va e'lonlar), `/admin/modullar` (modullarni yoqish/o'chirish).

## 8a. AI Bilim markazi (admin ichida alohida bo'lim)
`/admin/ai-bilim` (menyuda «AI Bilim markazi»): admin tasdiqlagan, manbali va muddatli bilimlar bazasi; AI uni birinchi ishlatadi, topilmasa mavjud zanjir (internet qidiruvi, bepul AI) ishlaydi. Nomzodlar faqat foydalanuvchi ixtiyoriy roziligi bilan, ko'rib chiqishga yuboriladi (avtomatik tasdiq yo'q). Provayder rollari, uzilish himoyasi, shaxssiz ehtiyoj statistikasi, audit. **Standart holat: o'chiq** (`Sozlamalar → AI → hubMode=off`), shuning uchun hozirgi ishlashga ta'sir qilmaydi. To'liq tavsif, cheklovlar va joriy etish tartibi: [KNOWLEDGE-HUB.md](KNOWLEDGE-HUB.md). Baza: yangi jadvallar `prisma/supabase-update-knowledge-base.sql` (faqat qo'shimcha; ixtiyoriy vektor: `...-vector.sql`). Sinov: `npm run test:e2e:knowledge`.

## 9. Telegram bot (Mini App va to'liq menyu)
Sayt Telegram ichida to'liq ilova (Mini App) sifatida ochiladi, kirish avtomatik (imzolangan initData tekshiriladi). Bundan tashqari bot saytning hamma bo'limini tugmalar bilan beradi: bosh sahifa, testlar, TOIFA reja, sinflar (ball kiritish), DARSYOR (AI bilan dars ishlanmasi va topshiriqlar), kutubxona, kurslar va obuna, seminarlar, AI yordamchi, profil; ro'yxatdan o'tish (ism, viloyat, tuman) botning o'zida; kunlik eslatma (reja, seminar, takrorlash). To'liq tavsif, sozlash va tekshiruv: [BOT.md](BOT.md). Baza: yangi `BotState` jadvali (`prisma/supabase-update-bot-state.sql`, faqat qo'shimcha, haqiqiy bazada qo'llangan).
