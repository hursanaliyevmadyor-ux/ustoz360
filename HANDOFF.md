# USTOZ 360: yangi sessiya uchun holat

Repo: `hursanaliyevmadyor-ux/ustoz360` (`main`). Hosting: Netlify (GitHub'ga ulangan, `main` push'da o'zi quriladi). Baza: Supabase (pooler 6543, `?pgbouncer=true`).

## Tayyor
- Next.js 15 + Prisma + PostgreSQL, 6 modul + admin (qisman demo, qisman haqiqiy).
- Kirish: email+parol, Google, Yandex, Telegram (Google/Yandex/Telegram kalitlar qo'yilgach ishlaydi).
- Haqiqiy backend: diagnostika, xatolar daftari, bilim xaritasi, takrorlash, dashboard, profil.
- AI: Claude (`/api/ai/chat|lesson|explain-error`, kalit `ANTHROPIC_API_KEY`) va BEPUL AI (OpenAI-mos shlyuz, `FREE_LLM_BASE_URL/KEY`), kunlik limitlar, `AiRequest` jurnali.
- `/bepul-ai/obunalarim`: Claude/ChatGPT/Gemini alohida oynada ochiladi (ular iframe'ga ruxsat bermaydi).
- Testlar: `npm test`, `test:e2e`, `test:e2e:social`, `test:e2e:ai`, `test:e2e:yandex` (serverga env bilan, README'ga qarang).

## Hal bo'lmagan
1. **Netlify'da login "Ichki xatolik" (500).** `prisma/schema.prisma` ga `rhel-openssl-3.0.x` qo'shilgan (5ff2cf7), natija tasdiqlanmagan. Aniq sabab: Netlify -> Logs -> Functions. Tekshiring: `DATABASE_URL`, `AUTH_SECRET` (>=32 belgi), `APP_URL`; Supabase'da `prisma/supabase-update-all.sql`, `supabase-update-ai.sql`, `supabase-update-yandex.sql` bajarilganmi.
2. Yandex / Google / Telegram kalitlari Netlify env'ga qo'yilmagan (README'da qadamlar).
3. `ANTHROPIC_API_KEY`, `FREE_LLM_*` qo'yilmagan.
4. Fan/mavzu ro'yxati (sertifikatgo.site namunasi), BILIMXONA (PDF suhbat), shaxsiy reja algoritmi: qilinmagan.
5. Brend nomi (USTOZ 360 yoki DarsgoAI): qaror yo'q.

## Qoidalar
- Foydalanuvchi o'zbek tilida yozadi, javob ham o'zbekcha, qisqa.
- Kalit/parollarni chatga yozdirmang: faqat Netlify env.
- Soxta ma'lumot/javob yasamang, demo bo'limlar "DEMO" deb belgilanadi.
- Bu muhitda eski `Islomchik04/Anoramahkamova.uz` repo'si yo'q: ishlatmang.
