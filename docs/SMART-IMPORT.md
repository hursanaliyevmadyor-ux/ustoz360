# Aqlli fayl yuklash va testlarni tekshirish (USTOZ AI)

USTOZ AI bosh sahifasidagi **«Nimani o'rganmoqchisiz?»** kartasi: foydalanuvchi fayl yuklaydi → savollar ajratiladi → javoblar mustaqil tekshiriladi →
o'qituvchi tasdiqlaydi → **shaxsiy test** (faqat egasiga) → ixtiyoriy ravishda **admin tasdig'i** → umumiy savollar banki.

Yangi test dvigateli, savollar banki yoki AI shlyuzi yaratilmagan: hammasi mavjud qismlarga ulangan (pastdagi «Audit» jadvali).

## 1. Audit: nima qayta ishlatildi

| Mavjud qism | Qanday ishlatiladi |
|---|---|
| `Question` / `AnswerOption` | Shaxsiy test savollari ham shu jadvalda (`ownerId`, `collectionId`, `status=DRAFT`, `source=IMPORT`). Boshqa bank yo'q. |
| `practiceView / submitAnswer / gradeDeferred` | Shaxsiy test ham shu dvigatelda ishlaydi (`startFixedPractice`): mashq = `quick`, test = `topictest`, diagnostika = `timed` (javoblar yakunda). |
| Mastery / xatolar kartasi | Faqat `APPROVED` va `source ≠ AI` savollarni sanaydi, shuning uchun `DRAFT` shaxsiy savollar umumiy statistikani buzmaydi. |
| `src/server/ai/gateway.ts` | Barcha AI chaqiruvlari shu yerdan (`runGeminiJson`, `runAi`, bepul provayder zaxirasi). Faqat `import` va `verify` turlari qo'shildi. |
| Tavily (`tavilySearch`) / AI Bilim markazi / BILIMXONA | Javobni tekshirishda dalil sifatida (faqat kerak bo'lganda). Bilim markazi faqat `hubMode = on` bo'lsa. |
| Admin panel | Yangi sahifa: `/admin/foydalanuvchi-testlari`. Audit jurnali va bildirishnomalar mavjudidan. |

## 2. Jarayon

```
UPLOADED → QUEUED → EXTRACTING → CLASSIFYING → VERIFYING → NEEDS_REVIEW / READY_FOR_USER → USER_APPROVED
                                                         (FAILED, CANCELED)
Shaxsiy test: PRIVATE_ACTIVE → SUBMITTED_TO_ADMIN → PUBLIC_APPROVED | REJECTED | ARCHIVED
```

Jarayon **qayta tiklanuvchan qadamlar** mashinasi (`src/server/import/pipeline.ts`): `PARSE → STRUCT → EXTRACT → KEYS → TOPICS → VERIFY`.
Har `POST /api/import/:id/advance` chaqiruvi bitta ish birligini bajaradi (lease 70 s). Sahifa yopilsa ham holat bazada; qaytib kirilganda davom etadi.
Vercel Cron (`/api/cron/import-resume`, kuniga bir marta) tashlab ketilganlarni davom ettiradi. Xatolikda ajratilgan savollar yo'qolmaydi.

## 3. Fayl turlari va o'qish usuli

| Tur | Usul |
|---|---|
| DOCX, XLSX, PPTX, ODT, ODS, ODP, CSV, TXT | Serverda, **qo'shimcha paketlarsiz** (ZIP/XML qo'lda o'qiladi): jadval, avtoraqamlash, sahifa/varaq/slayd. |
| PDF, JPG, PNG, WEBP | Gemini (multimodal, `generateContent`, ≤14 MB inline). Gemini kaliti bo'lmasa — **BLOCKED** (aniq xabar ko'rsatiladi). |
| DOC, XLS, PPT (eski) | Rad etiladi, yangi formatga o'tkazish yo'riqnomasi bilan. |
| Parolli / buzuq / noto'g'ri kengaytma | Tarkib (magic bytes) bo'yicha aniqlanadi va tushunarli xabar beriladi. |

Hajm: `IMPORT_MAX_MB` (standart 20 MB). Hosting so'rov chegarasi (~4,5 MB) sababli ≥3,5 MB fayllar 3 MB bo'laklarda yuklanadi (`prepare → chunk → complete`), yig'ilgach serverda qayta tekshiriladi.

## 4. Javobni tekshirish qoidalari (`verifylogic.ts → decide`)

- Fayldagi javob kaliti **hech qachon o'z-o'zicha haqiqat emas**. «Tayyor» (CONFIRMED) uchun mustaqil tasdiq kerak: AI kalit bilan mos / hisoblab topilgan / manba.
- Kalit va mustaqil natija farq qilsa — **Ziddiyatli**. Hech narsa topilmasa — **«Javob tasdiqlanmadi — qo'lda tekshirish kerak.»**
- Oddiy arifmetika savollari deterministik hisoblanadi (`mathcheck.ts`, `eval`siz).
- Ko'p javobli / moslashtirish / ketma-ketlik / qisqa javob turlari ajratiladi, lekin test dvigateliga **o'tkazilmaydi** (holat: «Mos kelmaydigan tur»).
- OCR ishonchsiz bo'lsa savol hech qachon «Tayyor» bo'lmaydi. Savol matni o'zgartirilmaydi: tahrir alohida (`editedText`), asl matn saqlanadi.
- Manbalar faqat haqiqatan topilganlari (URL/sahifa/iqtibos); o'ylab topilmaydi.
- Hamma narsa o'qituvchi «To'g'ri» demaguncha shaxsiy testga tushmaydi. `answerStatus`: `VERIFIED` | `USER_SET` | `UNVERIFIED`.

## 5. AI marshruti (model nomlari kodga yozilmagan)

1. Parser (qoidaga asoslangan) — tuzilma, jadvallar, kalit.
2. Gemini (tez model: `IMPORT_FAST_MODEL`, murakkab: `IMPORT_COMPLEX_MODEL`, aks holda `GEMINI_MODEL`) — ajratish va tasniflash.
3. Claude (`runAi`) — faqat qiyin/ziddiyatli savollarni ikkinchi marta tekshirish.
4. Dalil: Bilim markazi (`on` bo'lsa) → BILIMXONA → Tavily (`IMPORT_WEB_MAX` bilan cheklangan).
5. Bepul provayderlar — faqat matn uchun zaxira. Kunlik/daqiqalik chegara: `IMPORT_AI_DAILY_LIMIT`, `IMPORT_PER_MINUTE`.

## 6. Maxfiylik va ruxsatlar

- Barcha import API'lari egasi bo'yicha cheklangan; fayllar shaxsiy (private) bucketda, ko'rish uchun 5 daqiqalik imzolangan havola.
- Shaxsiy savollar `collectionId ≠ null`: umumiy savollar ro'yxati/statistikasi (`qbank`, `adminstats`, `adminsections`, `topicsData`, `knowledgeMap`) ularni hisoblamaydi.
- «Barcha ustozlar uchun ulashish»: **ulashish huquqi tasdig'i majburiy**. Admin: tasdiqlash / tahrirlab tasdiqlash / qayta tekshirishga qaytarish / rad etish / arxivlash. Har amal auditga yoziladi, foydalanuvchiga bildirishnoma boradi.
- Tasdiqlanganda umumiy bankka **alohida nusxa** yoziladi (`status=APPROVED`, `collectionId=null`); foydalanuvchining shaxsiy nusxasi o'zgarmaydi. Javobi tasdiqlanmagan savol admin aniq qabul qilmasa o'tmaydi. Tasniflanmagan savol uchun admin mavzu tanlaydi.
- Diagnostika: faqat `VERIFIED`/`USER_SET` savollar (tasdiqlanmaganlarni qo'shish foydalanuvchi tanlovi); to'g'ri javoblar tugaguncha ko'rinmaydi.

## 7. BLOCKED (kalit/ulanish yo'q bo'lsa) — sahifada ham ko'rsatiladi

| Narsa | Nima kerak | Holat |
|---|---|---|
| Fayl yuklash | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Ulanmagan bo'lsa yuklash o'chiq, sababi yoziladi |
| PDF/skaner/rasm o'qish | `GEMINI_API_KEY` | Bo'lmasa shu formatlar BLOCKED; DOCX/XLSX/PPTX/ODF/CSV/TXT ishlaydi |
| AI tekshiruv | Gemini, Claude yoki bepul provayder | Bo'lmasa faqat fayldagi kalit + hisob; ko'p savol «Tekshirish kerak» bo'ladi |
| Internet dalili | `TAVILY_API_KEY` | Bo'lmasa o'tkazib yuboriladi |
| Eski DOC/XLS/PPT | Konvertor (qo'shilmagan) | Rad etiladi, o'tkazish yo'riqnomasi bilan |

## 8. Joylashtirish tartibi (muhim)

1. **Avval SQL**: `prisma/supabase-update-smart-import.sql` (qo'shimcha, qayta ishga tushirsa ham xavfsiz; yangi jadvallar + `Question` ustunlari, RLS yoqilgan).
   `npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-smart-import.sql`
2. So'ng kod (Prisma `Question`dan yangi ustunlarni tanlaydi — SQL'siz kod xato beradi).
3. Muhit: yuqoridagi BLOCKED jadvaliga qarang; `CRON_SECRET` (cron uchun).
4. Tekshiruv: `npm run lint`, `npm test`, `npm run test:e2e:import`.

## 9. Testlar

- Birlik (`npm test`): `keyparse`, `qparse`, `formats`, `officetext`, `verify` (decide, matchKeys, mathcheck, aischema).
- E2E (`e2e/import.e2e.ts`, ishga tushirilgan sayt + haqiqiy baza + soxta Gemini): yuklash → ajratish → javoblar → tasdiq → shaxsiy test → diagnostika (javoblar yashirin) → adminga yuborish → admin tasdig'i → shaxsiylik.
