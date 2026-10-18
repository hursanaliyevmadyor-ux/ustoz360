# Telegram bot: Mini App va to'liq menyu

Sayt Telegram ichida to'liq ilova sifatida ochiladi (Mini App), shuningdek bot saytdagi hamma bo'limni tugmalar bilan ham beradi. Foydalanuvchi adashmasligi uchun: pastda doimiy menyu, har ekranda «Orqaga» va «Menyu» tugmalari, tugma bosilganda xabar yangilanadi (chat to'lib ketmaydi), buyruqlar `/menyu` bilan har doim boshiga qaytaradi.

## Mini App: sayt bot ichida
Saytning to'liq ko'rinishi Telegram ichida ochiladi (alohida brauzer yoki parol kerak emas). Ochish yo'llari: yozish maydoni yonidagi **«📱 Ilova»** tugmasi, pastdagi menyuning birinchi tugmasi **«📱 Ilovani ochish»**, bosh sahifa va profildagi tugma, `/ilova` buyrug'i.
- **Kirish avtomatik.** Telegram ilovaga imzolangan ma'lumot (initData) beradi; server uni bot tokeni bilan tekshiradi (`src/server/bot/webapp.ts`, imzo, 24 soatdan eski bo'lmasligi). Telegram akkaunti botda telefon bilan ro'yxatdan o'tgan bo'lsa, sessiya ochiladi (`POST /api/auth/telegram/webapp`). Ro'yxatdan o'tmagan bo'lsa: «Avval botda /start bosib, telefon raqamingizni yuboring».
- **Qurilmada boshqa odamning sessiyasi qolgan bo'lsa** (Telegram brauzeri qurilma bo'yicha umumiy), u Telegram egasining sessiyasiga almashtiriladi: boshqa odamning ma'lumoti ochilib qolmaydi.
- **Ilova ichida:** to'liq ekranga kengayadi, Telegram «Orqaga» tugmasi sahifalar bo'ylab ishlaydi, «Chiqish» bosilsa ilova yopiladi (keyingi ochishda yana avtomatik kiriladi). Kod: `src/components/telegram-mini-app.tsx`. Telegram skripti faqat Telegram ichida yuklanadi, oddiy brauzerga ta'sir qilmaydi.
- **Sozlash:** qo'shimcha kalit kerak emas. Menyu tugmasi va buyruqlarni sayt o'zi o'rnatadi (faqat https manzilda). Ixtiyoriy: BotFather → `/newapp` bilan botning profilida «Open app» tugmasi va `t.me/bot/ilova` havolasi (URL: sayt manzili).

## Menyu (pastdagi doimiy tugmalar)

| Tugma | Nima qiladi |
|---|---|
| 🏠 Bosh sahifa | Bugungi reja (bosib belgilanadi), tugallanmagan mashq, takrorlash, yaqin seminar, e'lonlar |
| 📚 Testlar | Tezkor mashq, mavzu bo'yicha mashq, xatolar ustida ishlash, natijalar va bilim xaritasi. Savol tugmalar bilan, javob darhol tekshiriladi. Vaqtli/yakunda tekshiriladigan testlar saytda (havola beriladi) |
| 🧭 TOIFA reja | Maqsad (imtihon, sana, kunlik vaqt), 7 kunlik reja (belgilash, qo'shish, o'chirish, avto tuzish), hujjatlar cheklisti, kalendar, rasmiy ma'lumotlar (tekshirilgan/tekshirilmagan) |
| 👩‍🏫 Sinflarim | Sinf yaratish, taxallusli o'quvchilar, baholash qo'shish, ballni matn bilan kiritish (`1 18`, `Oybek 17,5`), tahlil. O'quvchi ismi saqlanmaydi |
| 📝 DARSYOR | AI bilan dars ishlanmasi (4 savol) va test topshiriqlari (5 savol). Natija qoralama sifatida hujjatlarga saqlanadi. Hujjatlarim: ko'rish, o'chirish |
| 📖 Kutubxona | Qidirish, hammasi/mening/sevimlilar, yuklab olish havolasi, hujjatdan so'rash, chatga PDF/DOCX/TXT yuborib yuklash (saqlash xizmati ulangan bo'lsa) |
| 🛒 Kurslar | Katalog, sotib olish (buyurtma, to'lov kodi, ko'rsatma), mening kurslarim, obuna tariflari, buyurtmalarim |
| 📅 Seminarlar | Yaqin tadbirlar, batafsil va qatnashish havolasi |
| 🤖 AI yordamchi | Faqat shu tugma bosilganda yoqiladi: shundan keyingi matn AI'ga ketadi. Boshqa bo'limga o'tilsa, AI o'chadi (tasodifiy matn limitni sarflamaydi) |
| 👤 Profil | Tarif, AI limit, kurslar, eslatmani yoqish/o'chirish, maqsad, ism va hudud, yordam |

Buyruqlar: `/ilova`, `/menyu`, `/bosh`, `/testlar`, `/reja`, `/sinflar`, `/darsyor`, `/kutubxona`, `/kurslar`, `/seminarlar`, `/ai`, `/profil`, `/yordam`, `/yangi` (yangi AI suhbat), `/limit`.

## Ro'yxatdan o'tish
`/start` → telefon raqami (Telegram tasdiqlaydi) → ism-familiya → viloyat → tuman → menyu. Yakunlamaguncha boshqa bo'limlar yopiq. Saytdagi «Telegram» tugmasi bilan kirish avvalgidek ishlaydi (bir xil akkaunt).

## Kunlik eslatma
Har kuni 08:00 atrofida (Toshkent) Vercel Cron `/api/cron/bot-reminders` ni chaqiradi. Foydalanuvchiga faqat aytadigan gap bo'lsa xabar boradi: bugungi bajarilmagan reja, 36 soat ichidagi seminar, takrorlash vaqti kelgan xatolar, tugallanmagan mashq, imtihongacha 60/30/14/7/3/1 kun. Bir kunda bittadan ortiq yuborilmaydi; foydalanuvchi Profil'dan o'chira oladi; botni bloklagan foydalanuvchiga eslatma avtomatik o'chadi.
- Sozlash: Vercel → Environment Variables → `CRON_SECRET` (uzun tasodifiy qator), keyin Redeploy. `vercel.json` da jadval bor (`0 3 * * *` UTC). `CRON_SECRET` yo'q bo'lsa, cron 503 qaytaradi va hech kim chaqira olmaydi.
- To'lov tasdig'i kabi muhim shaxsiy bildirishnomalar (`payment`, `market`) botga ham yuboriladi.

## Texnik tuzilma
- `src/server/telegram.ts`: kirish (sayt ↔ bot), `/start`, telefon, webhook yangilanishlari (xabar va tugma).
- `src/server/bot/`: `router.ts` (yo'naltirish va xatolar), `ctx.ts` (holat va xabar yuborish), `tg.ts` (Telegram API), `ui.ts` (menyu), `botlogic.ts` (sana, ball, matn bo'lish), `digest.ts`, `remind.ts`, `sections/*` (har bo'lim).
- Holat jadvali `BotState` (`prisma/supabase-update-bot-state.sql`, faqat qo'shimcha, RLS yoqilgan): bot matn kutayotgan bosqich va eslatma sozlamasi. 45 daqiqadan keyin eskiradi. Jadval bo'lmasa bot ishdan chiqmaydi (menyu ishlaydi, ko'p bosqichli amallar ishlamaydi).
- Saytdagi xizmatlar qayta ishlatiladi (testlar, TOIFA, SINF, DARSYOR, MARKET, kutubxona): ruxsat va tekshiruvlar sayt bilan bir xil. DARSYOR AI mantiqi `src/server/ai/generate.ts` da, sayt va bot uchun umumiy.
- `callback_data` 64 bayt chegarasiga mos; HTML matn har doim `esc()` dan o'tadi; HTML tahlil xatosida xabar teglarsiz qayta yuboriladi.

## Tekshiruv
- Birlik testlari: `src/server/bot/*.test.ts`, `src/server/telegram.test.ts` (menyu, bosqichli amallar, xatolar, eslatma, Telegram qatlami).
- `e2e/bot.e2e.ts`: haqiqiy baza va ishga tushirilgan sayt bilan, Telegram o'rniga soxta server (`TELEGRAM_API_BASE`). Soxta server Telegram talablarini ham tekshiradi: HTML teglari, 4096 belgi, `callback_data` uzunligi. Ishga tushirish tartibi fayl boshida.

## Cheklovlar
- Vaqtli va aralash testlar, diagnostika, ko'rgazma/rubrika/kuzatuv varaqasi saytda (botda havola beriladi).
- Fayl yuklash va yuklab olish Supabase Storage ulanganda ishlaydi (hozir ulanmagan bo'lsa, bot halol xabar beradi).
- AI bo'limlari AI kaliti ulanganda ishlaydi; ulanmagan bo'lsa, bot buni aytadi.
