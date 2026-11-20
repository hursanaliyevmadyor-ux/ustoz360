# Dars xonasi

Ikki xil xona turi bor. Ikkalasiga ham o'quvchi ro'yxatdan o'tmasdan, havola bilan kiradi (`/d/<kod>`); ustoz `/dars` sahifasida xona yaratadi.

## 1. Video xona (Jitsi)
Bazasiz va kalitsiz. Kod havolada, dars Jitsi umumiy serverida (`NEXT_PUBLIC_JITSI_HOST` bilan o'zgartiriladi) ochiladi. Cheklov: umumiy serverda sahifa ichiga joylab bo'lmaydi; xonani ochgan ustozdan ba'zan Google bilan kirish so'raladi.

## 2. Ovozli xona (saytimiz ichida, LiveKit)
O'quvchi darsni shu sahifaning o'zida o'tkazadi: ishtirokchilar, mikrofon, qo'l ko'tarish, yozishma. Ustoz o'quvchiga gapirishga ruxsat beradi, hammani o'chiradi, darsni yakunlaydi.

**Sozlash (Vercel → Settings → Environment Variables, ixtiyoriy):** `LIVEKIT_URL` (`wss://...livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Kalitlar yo'q bo'lsa, ovozli xona o'chiq turadi (`GET /api/dars/status` → `{"voice":false}`), video xona o'zgarmaydi. `AUTH_SECRET` (>= 32 belgi) ham kerak: havola imzolari shundan hosil qilinadi.

**Xavfsizlik:** xona faqat tizimga kirgan ustoz yaratadi (`POST /api/dars/room`); kod va rejim `AUTH_SECRET` bilan imzolanadi. Havolada o'quvchi imzosi `k`, ustoz havolasida qo'shimcha boshqaruv imzosi `h` bo'ladi. Kirish belgisi (`/api/dars/token`) va boshqaruv (`/api/dars/control`) imzosiz ishlamaydi. Brauzerga LiveKit kaliti hech qachon berilmaydi, faqat 4 soatlik kirish belgisi.

**Rejimlar:** `s` = sinf (o'quvchi eshitadi, qo'l ko'taradi, ustoz ruxsat bergach gapiradi), `e` = erkin suhbat (hamma gapira oladi). Faqat mikrofon; video va ekran ulashish yopiq.

**Tuzilma:** `src/server/voicelogic.ts` (imzo, ruxsat), `voice.ts` (LiveKit), `src/components/dars/voice-engine.ts` (brauzer tomonidagi LiveKit qatlami), `voice-room.tsx` (ekran). Chat va qo'l ko'tarish LiveKit ma'lumot kanalida, bazaga yozilmaydi.

**Hali yo'q:** video, doska, ko'rgazma, vazifa topshirish, davomat (keyingi bosqichlar).
