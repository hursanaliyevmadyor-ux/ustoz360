# Internet qidiruvi (yagona AI oqimiga)

Foydalanuvchi yangi yoki rasmiy ma'lumot talab qiladigan savol bersa yoki tayyor material (test, namuna) izlasa, mavjud AI oqimi internetdan qidirib, **faqat manbada tasdiqlangan** ma'lumot bilan javob beradi. Mavjud bepul AI xizmatlari va zaxira tartibi o'zgarmagan.

## Oqim
1. **Tekshirilgan bilim bazasi** (`src/server/ai/kb.ts`): administrator manba bilan kiritgan rasmiy ma'lumotlar (TOIFA → Rasmiy ma'lumotlar) va admin tasdiqlagan ommaviy kutubxona hujjatlari. Yetarli darajada mos bo'lsa va (yangilik muhim bo'lmasa yoki yozuv 45 kun ichida tekshirilgan bo'lsa), internetga chiqilmaydi: kredit sarflanmaydi.
2. **Tavily** (asosiy qidiruv, `src/server/ai/tavily.ts`): avval kesh; rasmiy so'rovlarda (qaror, qoida, attestatsiya, DTM va h.k.) avval faqat rasmiy domenlar (`lex.uz`, `gov.uz`, `edu.uz`, `dtm.uz`...), natija bo'lmasa umumiy qidiruv.
3. **Ishonchlilik** (`trust.ts`): natijalar rasmiy → ta'lim portali → ommaviy axborot → norasmiy tartibida; ijtimoiy tarmoq (t.me, Facebook, YouTube...) boshqa manba bo'lsa chiqarib tashlanadi. Har manbada belgi ko'rinadi; rasmiy manba topilmasa javobga aniq ogohlantirish qo'shiladi.
4. **Qat'iy javob**: topilgan ma'lumot mavjud AI'ga kontekst sifatida beriladi; AI faqat manbalarga tayanadi, har fikrga `[n]` qo'yadi, topilmasa «Manbalarda aniq ma'lumot topilmadi» deydi, manbalar ichidagi ko'rsatmalarga amal qilmaydi. AI ulanmagan yoki limiti tugagan bo'lsa, javob to'qilmaydi: topilgan parchalar ko'rsatiladi.
5. **Tayyor material** (masalan «11-sinf 4-chorak matematika testlari»): fan, sinf, chorak va o'quv yili ajratilib qidiriladi. **Test yaratilmaydi**: topilgan havolalar va moslik (sinf ✓, fan ✓, chorak ✓, yil ✓) ko'rsatiladi. To'liq mos material topilmasa «topdim» deyilmaydi: qisman mosi alohida belgilanadi va yangi namunaviy material yaratish taklif qilinadi.
6. **Zaxira**: Tavily ishlamasa yoki chegaraga yetsa, Gemini + Google Search (agar `GEMINI_API_KEY` bor bo'lsa); javobga ehtiyotkorlik izohi qo'shiladi.

## Qachon qidiriladi
- Avtomatik (Admin → Sozlamalar → AI → «Avtomatik internet qidiruvi», standart yoqilgan): savolda yangi/rasmiy ma'lumot belgilari (qachon, yangi, qaror, qoida, attestatsiya, 2026...) yoki tayyor material belgilari (test/namuna + sinf yoki fan) bo'lsa. «Dars rejasi tuzib ber» kabi yaratish so'rovlari va umumiy bilim savollari («fotosintez nima?») qidirilmaydi.
- Qo'lda: saytdagi AI suhbatda «Internetdan qidirish» tugmasi.
- Qidiruv imkonsiz bo'lsa (limit, xizmat yo'q) avtomatik rejimda foydalanuvchi to'silmaydi: oddiy AI javob beradi.
- Bot: AI yordamchi rejimida ham avtomatik (manbalar matn ko'rinishida).

## Kesh va tejash
Natijalar `WebSearchCache` jadvalida 12 soat (yangilik muhim bo'lsa 3 soat) saqlanadi: bir xil savol kreditni qayta sarflamaydi. Haqiqiy Tavily so'rovi `web-credit` qatori bilan hisoblanadi. Foydalanuvchiga kunlik limit (standart 5, Admin'dan o'zgaradi); umumiy chegaralar: `TAVILY_MONTHLY_CAP` (900), `GEMINI_SEARCH_DAILY_CAP` (400).

## Sozlash (kalitlarni faqat o'zingiz Vercel'ga kiritasiz)
| O'zgaruvchi | Nima |
|---|---|
| `TAVILY_API_KEY` | app.tavily.com: bepul reja oyiga 1000 kredit, karta kerak emas |
| `TAVILY_MONTHLY_CAP` | ixtiyoriy, standart 900 |
| `GEMINI_API_KEY` | ixtiyoriy zaxira (aistudio.google.com). Bepul rejada qidiruv faqat 2.5 Flash/Flash-Lite, kuniga ~500 |
| `GEMINI_MODEL`, `GEMINI_SEARCH_DAILY_CAP` | ixtiyoriy |
| `FREE_LLM_*` ... `FREE_LLM10_*` | bepul AI xizmatlari endi 10 tagacha |

Baza: `prisma/supabase-update-web-cache.sql` (faqat qo'shimcha, RLS yoqilgan).

## Admin
Admin → Sozlamalar → AI: «Internetdan qidirish» kartochkasi: Tavily ulanishi (kalit ko'rinmaydi), shu oy sarflangan kreditlar va qolgani, Tavily hisobidagi rasmiy sarf (`/usage`, kredit sarflamaydi), bugungi qidiruvli javoblar, keshdan va bilim bazasidan berilgan javoblar, Gemini zaxirasi holati; avtomatik rejimni yoqish/o'chirish va foydalanuvchi kunlik limiti.

## Tekshiruv
Birlik testlari: `src/server/ai/{trust,intent,kb,tavily,websearch,websearchlogic,smart}.test.ts`, `src/lib/websources.test.ts`. E2E: `npm run test:e2e:websearch` (haqiqiy baza, soxta Tavily serveri: `TAVILY_API_BASE`, kredit sarflanmaydi).
