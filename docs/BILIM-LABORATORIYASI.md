# Bilim laboratoriyasi (Oddiy mashq 2.0)

> Hozir alohida bo'lim emas: **USTOZ AI → Testlar → Oddiy mashq** (`/ustoz-ai/mashq`). Tuzilma: [TESTLAR-2.md](TESTLAR-2.md).

Maqsad: "Javobni topish emas, sababini tushunish muhim." Oqim: tanlash, yechish, tushunish, sinab ko'rish, mustahkamlash.

## 1-bosqich: audit (mavjud holat)

Qayta ishlatilgan (parallel tizim yaratilmadi):
- `Question`, `AnswerOption`: tasdiqlangan savollar, izoh, qiyinlik, `isDemo`.
- `TestSession` (`mode = PRACTICE`), `UserAnswer` (har bir javob, `@@unique(sessionId, questionId)`).
- `TopicMastery` (mavzu bo'yicha natija), `ErrorCard` (xatolar daftari va oraliqli takrorlash).
- `src/server/scoring.ts`: `confidenceFor`, `nextReview`, `shuffle`.
- AI shlyuzi `src/server/ai/gateway.ts` (`runAi`, `runFreeAi`, kunlik limit, jurnal) va `requireVerified`.

Buzilmagan: diagnostika, `/api/review/*`, xatolar daftari, kirish tizimi, imtihon simulyatori.

Topilgan bo'shliqlar: savollar bazasi bo'sh (5 ta namunaviy savol), admin uchun savollar banki yo'q edi, "Oddiy mashq" tugmasi hech narsaga ulanmagan edi.

## 2-bosqich: arxitektura

**Bazaga qo'shilgan (hammasi qo'shimcha, hech narsa o'chirilmagan):**
`TestSession.config` (mashq sozlamalari, variantlar tartibi, ishoralar, "Tushundimmi?" savollari), `UserAnswer.hintUsed/answeredAt`,
`Question.superKey/source/sourceRef`, `QuestionReport` ("Savolda xato bor"). SQL: `prisma/supabase-update-practice.sql`, migratsiya `20261020100000_practice`.

**Sahifalar:** `/ustoz-ai/mashq` (bosh, 4 karta), `/ustoz-ai/mashq/sozlash`, `/ustoz-ai/mashq/[id]` (savol, izoh, natija), `/ustoz-ai/mashq/tarix`,
`/ustoz-ai/bilim-xaritasi` (2.0), `/admin/savollar` (haqiqiy savollar banki).

**API (`/api/practice/...`):** `home`, `topics`, `start`, `[id]` (davom ettirish), `[id]/answer`, `[id]/hint`, `[id]/explain`, `[id]/reinforce`, `[id]/reinforce/answer`, `[id]/finish`, `history`, `map`, `report`.
Admin: `/api/admin/qbank` va `/api/admin/qbank/[id]`.

**Xavfsizlik va to'g'rilik:**
- Javobni server tekshiradi (bazadagi kalit bo'yicha). Javob kaliti, izoh va Super kalit faqat javob berilgandan keyin yuboriladi.
- `answer` takroriy so'rovda oldingi natijani qaytaradi, qayta hisoblamaydi. Ikki so'rov bir vaqtda kelsa ham bitta natija.
- Foydalanuvchi faqat o'z mashqlarini ko'radi. Izoh/AI so'rovi savolga javob berilmaguncha 403.
- Mashq faqat `APPROVED` savollardan tuziladi. Ko'rilmagan savollar avval beriladi.

**AI qoidalari:** tekshirish AI'siz. AI faqat tushuntirish, variantlar tahlili, suhbat va yangi savol uchun; barcha so'rovlar tasdiqlangan kalitga tayanadi, xato sababi "ehtimol" tilida, manba va sahifa uydirilmaydi.
AI ishlamasa yoki limit tugasa mashq to'xtamaydi: saqlangan izoh va Super kalit ko'rsatiladi (halol belgi bilan). AI ulanmagan bo'lsa AI tugmalari ko'rsatilmaydi.
AI yaratgan savol: Zod sxemasi + sifat tekshiruvi, `DRAFT`, `source=AI`, mavzu bilimiga ta'sir qilmaydi, admin tasdiqlamaguncha mashqqa kirmaydi.

## Bilim xaritasi holatlari
`Hali mashq qilinmagan`, `O'rganilmoqda`, `Mustahkamlanmoqda`, `Barqaror natija kuzatilmoqda` (`src/server/practicelogic.ts: masteryState`).
Eng yuqori holat uchun: 8+ savol, 85%+ aniqlik, ochiq xato yo'q va kamida 2 ta o'rta/qiyin savol to'g'ri. Rangdan tashqari ikonka va matn ham ko'rsatiladi.

## Hozircha yo'q (halol ro'yxat)
- Moslashtirish, ketma-ketlik, "xatoni toping" kabi savol turlari (hozir: variantli test; yangi vaziyatli savol AI yoki bankdan).
- Manbaga tayangan AI (PDF/me'yoriy hujjat bilim bazasi hali yo'q, shuning uchun manba va sahifa ko'rsatilmaydi).
- AI izohlarini keshlash (har so'rov AI limitidan sarflanadi).
- Savollar soni kam: namunaviy savollar "Namunaviy savol" deb belgilangan, haqiqiy savollar admin panel orqali kiritilishi kerak.
- Ishora hozir AI'siz: bitta ehtimol noto'g'ri variantni chiqarib tashlaydi.

## Mahalliy ishga tushirish
```
npm run db:seed-practice     # namunaviy savollar (bir marta)
npm run dev
```
Bepul AI uchun `.env.local` ga `FREE_LLM_BASE_URL`, `FREE_LLM_API_KEY`, `FREE_LLM_MODEL` kiriting.
