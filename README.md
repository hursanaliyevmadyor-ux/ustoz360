# USTOZ 360: interaktiv frontend prototip

Next.js 15 (App Router) + TypeScript + Tailwind CSS 3 + Radix UI (shadcn/ui uslubidagi komponentlar) + Lucide.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + tip tekshiruvi
```

## Nima ishlaydi (faqat brauzerda)
- Yagona sidebar/topbar, breadcrumb, global qidiruv (Ctrl+K, sahifalar bo'yicha), bildirishnomalar, light/dark rejim
- Mobil: pastki navigatsiya va "Barcha xizmatlar" menyusi
- Oltita modul va admin panel, ichki sahifalari bilan (jami 40 ta sahifa)
- Diagnostika testi (5 ta DEMO savol, taymer, navigatsiya, mavzu bo'yicha natija)
- Filtrlar, jadvallar, kalendar, cheklistlar, fayl turi/hajmi tekshiruvi, dars ishlanmasi shabloni (.txt) va rubrika (.csv) yuklab olish

## Nima ishlamaydi (backend yo'q, soxtalashtirilmagan)
AI javoblari, autentifikatsiya, ma'lumotni saqlash, to'lov, fayl yuklash/indekslash. Tegishli joylarda "Prototip" ogohlantirishi chiqadi.
Barcha ma'lumotlar `src/lib/demo.ts` da va DEMO deb belgilangan; savollar ekspert tekshirmagan.

## Backend (MVP poydevori)
PostgreSQL + Prisma, Next.js route handlers (`src/app/api`), server kodi `src/server`.

```bash
cp .env.example .env            # DATABASE_URL, AUTH_SECRET
npx prisma migrate dev          # sxemani qo'llash
npm run db:seed                 # 5 ta DEMO savol (isDemo, ekspert tekshirmagan)
npm run dev
npm test                        # unit testlar (baholash, takrorlash, telefon)
BASE_URL=http://localhost:3000 npm run test:e2e   # API e2e (ishga tushgan server + baza kerak)
```

Ishlaydi: email+parol bilan kirish va ro'yxatdan o'tish (scrypt xesh, parol kamida 8 belgi, har email uchun 15 daqiqada 5 ta noto'g'ri urinishdan keyin 429, "email yoki parol noto'g'ri" umumiy xabari), httpOnly sessiya cookie,
serverda baholash (javob kaliti topshirishdan oldin klientga yuborilmaydi), faqat `APPROVED` savollar, mavzu bo'yicha mastery
(ishonchlilik qoidasi), xatolar daftari (oraliqli takrorlash), audit jurnali.

Takrorlash: `POST /api/review/start|submit`: muddati kelgan xato kartochkalaridan test; to'g'ri javob intervalni 2x qiladi (8 kundan keyin "o'zlashtirildi"), noto'g'ri javob 1 kunga qaytaradi.

Dashboard va profil: `GET /api/dashboard` (haqiqiy hisoblar, vazifalar holatdan olinadi), `GET|PUT /api/profile` (imtihon sanasi, kunlik vaqt).

Hali yo'q: email tasdiqlash va parolni tiklash (pochta xizmati kerak), AI, to'lov, fayl saqlash, admin API, reja algoritmi.
Vercel'da `DATABASE_URL` va `AUTH_SECRET` kerak; ularsiz sahifalar ishlaydi, diagnostika "Backend ulanmagan" va offline demo rejimini ko'rsatadi.

## Supabase
`prisma/migrations/*_enable_rls`: barcha jadvallarda RLS yoqiladi, siyosat yo'q, ya'ni Supabase'ning ochiq API'si (anon/authenticated) jadvallarga kira olmaydi.
Ilova bazaga faqat server orqali (DATABASE_URL, postgres roli) ulanadi, shuning uchun ishlashi o'zgarmaydi.

Bo'sh Supabase bazasini sozlashning ikki yo'li:
1. `DATABASE_URL` (Session pooler, port 5432) ni sozlab: `npx prisma migrate deploy && npm run db:seed`
2. Tarmoqsiz: **`prisma/supabase-setup.sql`** ni Supabase Dashboard → SQL Editor ga yopishtirib bir marta ishga tushiring
   (sxema + RLS + 5 ta DEMO savol). Keyin Prisma bilan davom etish uchun: `npx prisma migrate resolve --applied 20261014154048_init`
   va `--applied 20261014180000_enable_rls`.

Vercel'ga joylashda `DATABASE_URL` va `AUTH_SECRET` (32+ belgi) ni loyiha Environment Variables'ga qo'shing.

Mavjud Supabase bazasini yangilash (eski sxema o'rnatilgan bo'lsa), SQL Editor'da shu tartibda bir martadan: `prisma/supabase-update-email-auth.sql`, keyin `prisma/supabase-update-social-auth.sql`, keyin `prisma/supabase-update-ai.sql` (AI jadvali).

## Google va Telegram orqali kirish
Kalitlar o'rnatilmaguncha tugmalar ko'rinmaydi (`GET /api/auth/providers` qaysi usul sozlanganini aytadi).

**Google (Gmail):** console.cloud.google.com → OAuth consent screen (External) → Credentials → OAuth client ID (Web application).
Authorized redirect URI: `https://<sayt-manzili>/api/auth/google/callback`. Vercel'ga `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET`.
Authorization Code + PKCE, `state` va `nonce` tekshiriladi, faqat `email_verified` bo'lgan Google emaillari qabul qilinadi.
Shu email bilan oldin parol orqali ochilgan (tasdiqlanmagan) akkaunt bo'lsa, u egallab olinishi mumkinligi uchun parol bekor qilinadi va eski sessiyalar o'chiriladi.

**Telegram:** @BotFather → `/newbot` → bot tokeni. Keyin `/setdomain` bilan botga sayt domenini (masalan `darsgoai.vercel.app`) bog'lang, aks holda vidjet ishlamaydi.
Vercel'ga `TELEGRAM_BOT_TOKEN` va `TELEGRAM_BOT_USERNAME` (@ belgisiz). Telegram imzosi (HMAC-SHA256) va `auth_date` (10 daqiqa) serverda tekshiriladi.
Telegram email bermaydi, shuning uchun Telegram akkaunti email akkauntlari bilan avtomatik birlashtirilmaydi.

Testlar: `npm test` (unit), `npm run test:e2e` va `npm run test:e2e:social` (social uchun server GOOGLE_*/TELEGRAM_* test qiymatlari va
`GOOGLE_TOKEN_URL=http://localhost:4455/token` bilan ishga tushirilgan bo'lishi kerak; fayl boshidagi izohga qarang).

## AI bo'limi

Claude API (rasmiy `@anthropic-ai/sdk`) orqali ishlaydi. Faqat serverda chaqiriladi, kalit brauzerga chiqmaydi.

| O'zgaruvchi | Ma'nosi |
| --- | --- |
| `ANTHROPIC_API_KEY` | Majburiy. Yo'q bo'lsa AI 503 qaytaradi, interfeys "ulanmagan" deb ko'rsatadi |
| `AI_MODEL` | Ixtiyoriy, standart `claude-opus-5-5`. Arzonroq: `claude-haiku-5-5` |
| `AI_DAILY_LIMIT` | Ixtiyoriy, har foydalanuvchiga kuniga so'rovlar soni (standart 30) |
| `AI_GLOBAL_DAILY_LIMIT` | Ixtiyoriy, butun sayt uchun kunlik chegara (standart 2000) |

Yo'llar: `GET /api/ai/status`, `POST /api/ai/{chat,lesson,explain-error}`. Faqat tizimga kirganlar uchun. `AiRequest` jadvali faqat token soni va holatni saqlaydi, matnni emas. Test: `ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://localhost:4466 AI_DAILY_LIMIT=5 next dev -p 3113`, so'ng `BASE_URL=http://localhost:3113 npm run test:e2e:ai`.

### Bepul AI va o'z obunalar

- **BEPUL AI** moduli (`/bepul-ai`): OpenAI-mos shlyuz orqali. [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) ni o'zingiz joylab, manzil va kalitni bering: `FREE_LLM_BASE_URL` (masalan `https://sizning-domen/v1`), `FREE_LLM_API_KEY`, ixtiyoriy `FREE_LLM_MODEL` (standart `auto`) va `AI_FREE_DAILY_LIMIT` (standart 50). Bepul AI limiti Claude limitiga qo'shilmaydi.
- **Mening AI obunalarim** (`/bepul-ai/obunalarim`): Claude, ChatGPT, Gemini'ni saytning yonida alohida oynada ochadi. Ular boshqa saytlar ichida ochilishini taqiqlagani uchun iframe ishlamaydi; kirish ularning o'z sahifasida bajariladi, parol/kodlar bizga o'tmaydi.
