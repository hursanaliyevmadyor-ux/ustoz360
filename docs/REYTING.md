# Ustozlar reytingi, Imtihon simulyatori va Profil 2.0

Bu hujjat reyting tizimi qanday ishlashini, admin nimalarni sozlay olishini va ishga tushirishdan oldin nima kerakligini tushuntiradi.

## Foydalanuvchi nimani ko'radi

- **Yon menyu**: `USTOZ AI` dan keyin **Imtihon simulyatori** (`/imtihon`) va **Ustozlar reytingi** (`/reyting`). USTOZ AI → Testlar ichidagi eski «Imtihon simulyatsiyasi» kartasi olib tashlangan.
- **Imtihon simulyatori**: sarlavha «Haqiqiy sinovga tayyormisiz?», qisqa xulosa (nechta imtihon reytingga hisoblanadi, nechtasi yakunlangan, oxirgi natija). Natija sahifasida to'g'ri / noto'g'ri / javobsiz sonlari, reytingga hisoblangani yoki hisoblanmagani sababi bilan va tugmalar: Xatolarimni ko'rish, Natijalarim, Reytingdagi o'rnim.
- **Ustozlar reytingi**: tablar *Umumiy / Attestatsiya / Milliy sertifikat*, TOP-3 podium (2-1-3), TOP 4–10 qatorlari, 11 va undan keyingilar uchun qidiruv va sahifalash, «Mening reytingim» kartasi (o'rin, indeks, sabab va keyingi qadam).
- **Bosh sahifa**: ixcham «Mening reytingim» kartasi va «To'liq reytingni ko'rish →» havolasi.
- **Profil**: avatar, noyob nik, «Qaysi imtihonga tayyorlanyapsiz?» yo'nalishi, reytingda qatnashishga ixtiyoriy rozilik.
  - **Nik asosiy nom**: profil yuqorisida, yon menyuda va yuqori paneldagi profil tugmasida nik katta (yumaloq quyuq shriftda), ism familiya esa pastda kichik yoziladi. Nik yo'q bo'lsa, ism familiya ko'rinadi va yoniga «Nik yaratish» tugmasi chiqadi (nikni profil yuqorisidagi qalamcha orqali ham o'zgartirsa bo'ladi).
  - **Avtomatik rasm**: yangi foydalanuvchiga 10 ta tayyor multfilm qahramonidan biri avtomatik beriladi (identifikatoridan hisoblanadi, shuning uchun har safar bir xil). Qahramonlar original chizilgan (bilimdon boyqush, do'st robot, sehrgar, zukko tulki, kosmik mushuk, kichik ajdar, o'rmon elfi, pingvin professor, kitobxon ayiqcha, jasur ritsar), real odam rasmi yo'q. Fayllar: `public/avatars/p1.svg … p10.svg`.
  - Kamera tugmasi: tayyor rasmlardan birini tanlash, o'z rasmini yuklash (JPG, PNG, WebP, eng ko'pi 2 MB, aylana shaklida qirqiladi) yoki «Standart rasmga qaytish». Tanlangan tayyor rasm `Profile.avatarPath` da `preset:pN` ko'rinishida saqlanadi, shuning uchun bazaga yangi ustun kerak emas.

Reytingga kirish sharti: rozilik berilgan, nik tanlangan, kamida bitta diagnostika yakunlangan va kamida bitta *taqqoslanadigan* reyting sinovi topshirilgan. Aks holda «Reytingga kirish uchun diagnostika va bitta reyting sinovini yakunlang.» deb chiqadi.

## Maxfiylik

- Ommaviy ko'rinadigan narsa faqat: **nik, avatar, o'rin va indeks**.
- Ism, email va telefon hech qachon reytingda ko'rinmaydi.
- Yuklangan avatar faqat egasiga, adminga va reytingda qatnashishga rozilik bergan (yashirilmagan) foydalanuvchiga ko'rinadi: `/api/avatars/[key]`. Tayyor multfilm rasmlari shaxsiy ma'lumot emas, shuning uchun ommaviy fayl sifatida beriladi.
- Rasmdan yuklashda EXIF/GPS va boshqa metama'lumotlar serverda olib tashlanadi (JPEG, PNG, WebP). Animatsiyali rasm rad etiladi.
- Reytingdan chiqqanda shaxsiy natijalar saqlanadi, faqat ommaviy ro'yxatdan olinadi.

## Hisoblash usuli

Xom foizlar to'g'ridan-to'g'ri taqqoslanmaydi: qiyin imtihondagi 60% oson imtihondagi 80% dan yomon bo'lmasligi mumkin.

1. Har bir reytingga hisoblanadigan imtihon uchun shu imtihonni topshirganlarning o'rtachasi va tarqalishi (standart og'ish) olinadi. Foydalanuvchining natijasi z-ballga aylantiriladi. Tarqalish juda kichik bo'lsa, quyi chegara 0,05.
2. Imtihon faqat kamida `minParticipants` ta ishtirokchi bo'lgandan keyin **taqqoslanadigan** hisoblanadi. Ishtirokchi kam bo'lsa, shaxsiy natija ko'rinadi, lekin umumiy o'rin berilmaydi (adolatsiz o'rin bermaslik uchun).
3. Bir imtihondan faqat dastlabki `maxAttempts` ta urinish hisoblanadi, ular ichidan eng yaxshisi olinadi: bir imtihonni ko'p marta ishlab reytingni ko'tarib bo'lmaydi.
4. Diagnostika: oxirgi 3 ta yakunlangan diagnostikaning o'rtachasi, ishtirokchilar bo'yicha shunday standartlanadi.
5. `indeks = 50 + 10 × (imtihonVazni·zImtihon + diagVazni·zDiagnostika) / (imtihonVazni + diagVazni)`, 0..100 oralig'ida, 0,1 gacha yaxlitlanadi.
6. Teng indeks teng o'rin oladi (masalan 1, 2, 2, 4).
7. Yo'nalish reytingi: profilida shu yo'nalish tanlangan ustozlar, shu yo'nalishdagi yoki yo'nalishsiz imtihonlar. «Umumiy» reytingda hamma ishtirokchi va hamma imtihon.

Hisob bazadagi asl natijalardan (`ExamAttempt`, `TestSession` rejimi DIAGNOSTIC) har safar qayta olinadi va 60 soniya keshlanadi. Alohida «reyting jadvali» yo'q, shuning uchun bir natija ikki marta hisoblanmaydi va qo'lda tuzatish kerak emas. Vaznlar (70/30) mahsulot taklifi: ilmiy isbotlangan universal formula emas, admin o'zgartira oladi.

## Admin: Reyting boshqaruvi (`/admin/reyting`)

- Reytingni yoqish/o'chirish.
- Yo'nalishlar ro'yxati (kalit + nom), imtihon va diagnostika vazni, urinishlar soni, minimal ishtirokchi soni, talab qilinadigan diagnostikalar soni, mavsum boshlanishi.
- Imtihonlar jadvali: har biriga yo'nalish va «reytingga hisoblansin» tugmasi. Imtihonni nashr qilish uni avtomatik reytingga qo'shmaydi.
- «Reytingni qayta hisoblash» tugmasi (keshni tozalaydi).
- Moderatsiya: nik bo'yicha qidirish, yashirish/qaytarish, nomaqbul nikni tiklash, rasmni olib tashlash. Hammasi audit jurnaliga yoziladi (`ranking.*`).

Imtihon sahifasida (`/admin/imtihonlar/[id]`) ham shu imtihonning yo'nalishi va reytingga hisoblanishi belgilanadi.

## API

| Yo'l | Nima qiladi |
|---|---|
| `GET /api/leaderboard?direction=&page=&q=` | Reyting (podium, TOP 4–10, qolganlari sahifalab) |
| `GET /api/leaderboard/me?direction=` | Mening o'rnim, sabab va keyingi qadam |
| `GET /api/leaderboard/directions` | Yo'nalishlar ro'yxati |
| `GET /api/leaderboard/seasons` | Mavsum ma'lumoti |
| `POST /api/leaderboard/participation` | Reytingda qatnashishga rozilik berish/qaytarib olish |
| `PUT /api/profile/nickname` | Nik o'rnatish (band bo'lsa 409 «Bu nik band.») |
| `GET /api/profile/nickname?value=` | Nik bo'shligini tekshirish |
| `POST /api/profile/avatar` | O'z rasmini yuklash |
| `PUT /api/profile/avatar` (`{ "preset": "p3" }`) | Tayyor rasmlardan birini tanlash |
| `DELETE /api/profile/avatar` | Standart (avtomatik) rasmga qaytish |
| `GET /api/avatars/[key]` | Yuklangan rasmni himoyalangan holda berish (tayyor rasmlar ommaviy statik fayl) |
| `GET /api/admin/rankings` | Admin umumiy ko'rinish |
| `PUT /api/admin/rankings/settings` | Sozlamalar va imtihonlarni tahrirlash |
| `POST /api/admin/rankings/recalculate` | Qayta hisoblash |
| `POST /api/admin/rankings/moderate` | Moderatsiya amallari |

## Ishga tushirish tartibi (production)

1. Bazadan zaxira nusxa olinadi.
2. **Avval** `prisma/supabase-update-ranking.sql` qo'llanadi. U faqat qo'shadi (`ADD COLUMN IF NOT EXISTS`, indekslar), mavjud ma'lumotni o'chirmaydi. Kod yangi ustunlarni o'qiydi, shuning uchun SQL kod deploydan oldin bo'lishi shart.
3. Keyin kod deploy qilinadi.
4. Admin: `/admin/reyting` da kerakli imtihonlarni «reytingga hisoblansin» qilib belgilaydi va yo'nalishini tanlaydi.
5. Avatar uchun Supabase Storage sozlangan bo'lishi kerak (kutubxona/import bilan bir xil sozlama).

## Hozircha qilinmagan yoki sinalmagan

- Mavsumlar uchun alohida boshqaruv ekrani yo'q: faqat boshlanish sanasi sozlamasi bor.
- Shubhali natijalarni ko'rib chiqish (tezkor topshirish, bir xil javoblar) hali yo'q.
- Mavzu bo'yicha tahlil reytingga qo'shilmagan.
- Fon vazifalari yo'q: hisob so'rov paytida olinadi; kesh serverning har bir nusxasida alohida (60 soniya).
- Kirgan holda brauzerda to'liq ko'rib chiqish va haqiqiy bazada E2E sinov hali o'tkazilmagan.
