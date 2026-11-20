# Dars xonasi

Dars saytimizning ichida o'tadi (LiveKit): ovoz, kamera, ekran ulashish, ishtirokchilar, qo'l ko'tarish va yozishma. O'quvchi ro'yxatdan o'tmasdan, havola bilan kiradi (`/d/<kod>`); ustoz tizimga kirib, `/dars` sahifasida xona yaratadi. Jitsi butunlay olib tashlangan.

**Sozlash (Vercel → Settings → Environment Variables):** `LIVEKIT_URL` (`wss://...livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Kalitlar yo'q bo'lsa, xona yaratib bo'lmaydi (`GET /api/dars/status` → `{"voice":false}`). `AUTH_SECRET` (>= 32 belgi) ham kerak: havola imzolari shundan hosil qilinadi. `NEXT_PUBLIC_JITSI_HOST` endi ishlatilmaydi.

**Xavfsizlik:** xona faqat tizimga kirgan ustoz yaratadi (`POST /api/dars/room`); kod va rejim `AUTH_SECRET` bilan imzolanadi. Havolada o'quvchi imzosi `k`, ustoz havolasida qo'shimcha boshqaruv imzosi `h` bo'ladi. Kirish belgisi (`/api/dars/token`) va boshqaruv (`/api/dars/control`) imzosiz ishlamaydi. Brauzerga LiveKit kaliti hech qachon berilmaydi, faqat 4 soatlik kirish belgisi. Imzosiz (eski, Jitsi) havolalar ishlamaydi: "Bu eski havola" xabari chiqadi.

**Rejimlar:**
- `s` = sinf: o'quvchi eshitadi va ko'radi, qo'l ko'taradi; ustoz ruxsat bergach mikrofon va kamerasini yoqadi. Ekran ulashish faqat ustozda.
- `e` = erkin suhbat: hamma mikrofon va kamerasini yoqa oladi. Ekran ulashish faqat ustozda.

**Ekran:** katta oynada ustozning ekrani (ulashilsa) yoki kamerasi; ostida kamera plitkalari, ishtirokchilar ro'yxati, yozishma. Ekran ulashish tugmasi faqat ustozda va faqat kompyuterda ko'rinadi (telefon brauzerlari qo'llamaydi). Kamera sifati ustozda 720p, boshqalarda 360p; `adaptiveStream` va `dynacast` internetni tejaydi.

**Ovozli xabar (chatda):** hamma (o'quvchi ham, ustoz ham) chatdagi mikrofon tugmasi bilan 60 soniyagacha ovozli xabar yozib yuboradi (Telegramdagidek: yozish → yuborish yoki bekor qilish). Brauzerda yoziladi (mp4, bo'lmasa webm/ogg, ~24 kbit/s), 12 KB li bo'laklarga bo'linib LiveKit ma'lumot kanalida (`voice` topic) yuboriladi va qabul qiluvchida qayta yig'iladi (`src/lib/voice-clip.ts`). Hech qayerga saqlanmaydi: faqat xabar paytida xonada bo'lganlar eshitadi, xonadan chiqilsa yo'qoladi. Himoya: bo'lak soni va hajmi cheklangan, buzilgan paketlar tashlanadi, bir yuboruvchidan tez-tez kelgan xabarlar tashlanadi. Mikrofon ruxsati LiveKit'dagi mikrofondan alohida so'raladi (sinfda o'quvchi gapirishga ruxsatsiz ham ovozli xabar yubora oladi).

**Tuzilma:** `src/server/voicelogic.ts` (imzo, ruxsat), `voice.ts` (LiveKit server tomoni), `src/components/dars/voice-engine.ts` (brauzer tomonidagi LiveKit qatlami; sinovda soxta engine beriladi), `voice-room.tsx` (ekran), `voice-note.tsx` (ovozli xabarni yozish va eshitish), `join-room.tsx` (kirish: ism, kamera/mikrofon tekshiruvi). LiveKit kodi faqat xonaga kirilganda yuklanadi. Chat va qo'l ko'tarish LiveKit ma'lumot kanalida, bazaga yozilmaydi.

**Tekshirib bo'lmagan joy:** haqiqiy LiveKit ulanishi sandbox'dan sinalmagan (tarmoq yopiq); mantiq soxta engine bilan, ulanish esa deploydan keyin 2 qurilmada tekshiriladi.

**Hali yo'q:** doska, ko'rgazma (material), vazifa topshirish, jonli mini-test, AI yordamchi, davomat (keyingi bosqichlar).
