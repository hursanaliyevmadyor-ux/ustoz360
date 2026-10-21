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

### Kutish chegaralari (foydalanuvchi uzoq kutib qolmaydi)

- Tekshiruv paketlari kattaroq (10 savol) va bir `advance` chaqiruvida 2 paket parallel ishlaydi: 60 savol taxminan 3 ta AI chaqiruvi.
- Bitta paket uchun AI vaqti 35 s bilan cheklangan (funksiya chegarasi 60 s); matnli AI so'rovi 25 s.
- AI ketma-ket 2 marta xato bersa yoki band/limit holati 2 marta takrorlansa, AI o'sha import uchun o'chiriladi (`aiBlocked`): qolgan savollar fayldagi kalit bo'yicha darhol ko'rib chiqiladi, sahifada sababi ko'rsatiladi. «Hammasini qayta tekshirish» AI'ni qayta yoqadi.
- Ajratish bosqichida (AI kerak bo'lganda) ketma-ket 6 marta band bo'lsa jarayon to'xtatiladi, topilgan savollar saqlanadi, «Davom ettirish» bilan davom etadi.
- Gemini xatosining sababi (kalit/model noto'g'ri — kod bilan) import sahifasida eslatma sifatida ko'rinadi; kalitning o'zi hech qayerda ko'rsatilmaydi.

## 3. Fayl turlari va o'qish usuli

| Tur | Usul |
|---|---|
| DOCX, XLSX, PPTX, ODT, ODS, ODP, CSV, TXT | Serverda, **qo'shimcha paketlarsiz** (ZIP/XML qo'lda o'qiladi): jadval, avtoraqamlash, sahifa/varaq/slayd. |
| PDF, JPG, PNG, WEBP | Gemini (multimodal, `generateContent`, ≤14 MB inline). Gemini kaliti bo'lmasa — **BLOCKED** (aniq xabar ko'rsatiladi). |
| DOC, XLS, PPT (eski) | Rad etiladi, yangi formatga o'tkazish yo'riqnomasi bilan. |
| Parolli / buzuq / noto'g'ri kengaytma | Tarkib (magic bytes) bo'yicha aniqlanadi va tushunarli xabar beriladi. |

Hajm: `IMPORT_MAX_MB` (standart 50 MB; Supabase bepul rejasining bitta fayl chegarasi ham shu). Hosting so'rov chegarasi (~4,5 MB) sababli ≥3,5 MB fayllar 3 MB bo'laklarda yuklanadi (`prepare → chunk → complete`), yig'ilgach serverda qayta tekshiriladi.

### Katta to'plamlar (600+ betlik testlar) va rasmli savollar

- **Faqat savol va javob.** AI ko'rsatmasi (`prompts.ts`): muqova, mundarija, sahifa sarlavhalari/pastliklari (kanal nomi, muallif, bet raqami), reklama va nazariy matn olinmaydi. Variantlar bir qatorda yoki ikki ustunda bo'lsa ham A, B, C, D tartibida; ko'chirma matn, raqamlangan gaplar va ko'rsatma qatori savol matniga kiradi.
- **Test guruhlari.** Har bir savol va kalit yozuvi o'z test sarlavhasiga (`group`, masalan «Diagnostika testi Kuzgi No: 1») bog'lanadi; raqamlash har testda qayta boshlansa ham adashmaydi. Kalit («TEST JAVOBLARI» jadvallari) savolning o'z testi bo'yicha topiladi.
- **Sahifalarni tanlash.** 60 betdan katta PDF uchun foydalanuvchi sahifalarni yozadi (masalan `3-14, 655-657`: savollar va ularning kaliti). Butun fayl emas, faqat shu sahifalar kesilib (`pdf-lib`, sof JS) AI'ga yuboriladi: tezroq, arzon va 14 MB AI chegarasiga bog'liq emas. Kichik PDF avtomatik tuzilma aniqlashdan o'tadi (savollar va javoblar kaliti sahifalari alohida o'qiladi).
- **Rasm/jadval/formula.** Savolda rasm bo'lsa, AI joyini matnga `[[RASM:n]]` deb qo'yadi va sahifa + qutini (0–1000 koordinata) beradi. Tekshiruv sahifasi asl sahifadan rasmni brauzerda kesib (pdf.js, CDN) savolning o'z joyida ko'rsatadi. «Testga saqlash»da kesilgan PNG serverga yuklanadi (`figures/<egasi>/...`), savol matnida `[[rasm:egasi/nom]]` bo'lib qoladi va test, diagnostika, admin ko'rinishida o'z joyida chiqadi. Admin tasdiqlasa, rasm umumiy nusxaga (`global/...`) ko'chiriladi. Rasmli savolni AI matn bilan «yecha» olmaydi: javob faqat fayldagi kalit + o'qituvchi tasdig'i bilan.

### Savol chegarasi (qat'iy qoida) va DOCX rasmlari

- **Savol variantlar tugaguncha davom etadi.** Savol o'z raqamidan boshlanadi; variantlardan (A, B, C, D) oldingi raqamli qatorlar (1., 2., 3., 4. gaplar, «To'g'ri javobni aniqlang» ko'rsatmasi) o'sha savolning matni hisoblanadi, alohida savol emas. Keyingi savol faqat variantlar tugagach, raqam tartibida boshlanadi. Qoidalar bilan ajratishda (`qparse.ts`) bu oldinga qarab aniqlanadi: variantlar bloki topiladi va undan keyingi raqam shu savoldan keyingisiga davom etsa, oradagi raqamli qatorlar savol matniga qo'shiladi (har gap yangi qatorda, asl tartibda). Variantsiz savol (keyingi savolning variantlari bilan almashib qolmasligi uchun) va bo'lim sarlavhasi (Test 2) oldidagi savol alohida qoladi. AI ko'rsatmasida ham xuddi shu qoida «QUESTION BOUNDARY» sifatida yozilgan.
- **DOCX ichidagi rasm o'z joyida.** Word faylidagi rasm paragrafda qaysi so'zdan keyin kelgan bo'lsa, savol matnida shu joyda `[[RASM:n]]` bo'lib turadi; rasmning o'zi fayldan olinib darhol saqlanadi (brauzerda kesish shart emas) va tekshiruv sahifasida o'z joyida ko'rinadi. Variant yonida yozuv bilan birga kelgan (suzuvchi) rasm savolga tegishli deb savol matni oxiriga qo'yiladi. Variantning o'zi rasm bo'lsa, rasm savol matniga variant harfi bilan qo'shiladi (`A) [[RASM:1]]`), variant matni «(rasm)» bo'ladi. PNG, JPEG, GIF, WebP qo'llab-quvvatlanadi; EMF/WMF va 3 MB dan katta rasm ko'chirib bo'lmaydi: bunday savol «o'qib bo'lmaydigan rasm» deb belgilanadi va savol matnidan belgi olib tashlanmaguncha testga saqlanmaydi.
- **Aniq ajratib bo'lmasa (PDF va rasm).** AI savol matnini matn sifatida aynan ko'chira olmasa (rasm, formula, jadval, belgili chizma), matnni o'ylab topmaydi: sahifaning savol raqamidan A variantigacha bo'lgan qismini rasm sifatida beradi (`[[RASM:1]]` + qutisi), brauzer uni asl sahifadan kesib savolga biriktiradi. Word (DOCX) fayllarida sahifa ko'rinishini chizib bo'lmaydi, shuning uchun u yerda faqat faylga joylangan rasmlar ko'chiriladi.

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
