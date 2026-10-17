# Testlar 2.0 (USTOZ AI → Testlar)

Rejimlar yagona dizayn tizimida va yagona test dvigatelida ishlaydi. Bilim laboratoriyasi (Oddiy mashq) shu dvigatelning bir qismi: [BILIM-LABORATORIYASI.md](BILIM-LABORATORIYASI.md).

## USTOZ AI: bitta umumiy bo'lim
O'xshash bo'limlar alohida bo'lib qolmasligi uchun hammasi bitta USTOZ AI ichida (tab qatorisiz: yo'l ko'rsatkichi va tanlash kartalari). Har bir bo'limga kirilganda keyingi rejimni tanlash ekrani chiqadi (hammasida bir xil `ChoiceCard`). Barcha modullar: [BOLIMLAR.md](BOLIMLAR.md).

| Tab | Ichida |
|---|---|
| **Umumiy** (`/ustoz-ai`) | "Keyingi qadam" (haqiqiy ma'lumotga tayanadi) va bo'limlar: **Diagnostika** (shu yerda qoladi), Testlar, Natijalarim, Shaxsiy reja, AI bilan suhbat |
| **Testlar** | Oddiy mashq (Tezkor / Tanlab / AI bilan o'rganish), Vaqtli, Mavzuli, Aralash, Vaziyatli, Xatolar testi, Imtihon simulyatsiyasi |
| **Natijalarim** | Bilim xaritasi, Xatolar daftari, Mashqlar tarixi |
| **Shaxsiy reja** | TOIFA NAVIGATOR → Reja (haqiqiy, natijalardan qoidalar bilan tuziladi) |

Birlashtirilgan takrorlar: "Bilim laboratoriyasi" alohida bo'lim emas (Oddiy mashq bo'ldi); "Xatolarim" kartasi va eski "Takrorlash" sahifasi (Xatolar testiga yo'naltiriladi); Diagnostika Testlar ichida takrorlanmaydi; yon menyudagi "Imtihon simulyatori", "Bilim laboratoriyasi" va "AI yordamchisi" USTOZ AI ichiga olindi. Eski manzillar ishlaydi, yo'l ko'rsatkichi va faol tab bo'lim bo'yicha ko'rsatiladi (`resolveSub`).

## Rejimlar holati (Diagnostika va Imtihon simulyatsiyasi ham shu jadvalda)

| Rejim | Sahifa | Holat | Qanday ishlaydi |
|---|---|---|---|
| Oddiy mashq | `/ustoz-ai/mashq` | tayyor | Vaqtsiz, har javobdan keyin izoh, ishora, AI murabbiy, "Yana bir misolda sinash" |
| Vaqtli test | `/ustoz-ai/testlar/sozlash?mode=timed` | tayyor | Server taymeri, navigator, belgilash, javoblar yakunda tekshiriladi, vaqt tugasa avtomatik yakunlanadi |
| Mavzuli test | `...?mode=topic` | tayyor | Bitta mavzu, "Bu mavzuda nimalarni bilib olasiz?" (admin kiritadi), ixtiyoriy taymer, tushunchalar bo'yicha tahlil |
| Aralash test | `...?mode=mixed` | tayyor | Bir nechta mavzu, teng yoki "zaif mavzular ko'proq" taqsimot, ixtiyoriy taymer, yakunda tekshiriladi |
| Murakkab vaziyatli test | `...?mode=situational` | tayyor (namunaviy savollar bilan) | Dars vaziyati, to'rtta yaqin variant, "Qaroringizni asoslang" (AI mezonlar bo'yicha tahlil, ulanmagan bo'lsa faqat saqlanadi) |
| Xatolar testi | `...?mode=errors` | tayyor | "Eski xatolarim" va "Yangi vaziyatda sinash" (shu ko'nikmaga oid boshqa savollar); mavjud oraliqli takrorlash qayta ishlatiladi |
| Diagnostika | `/ustoz-ai/diagnostika` (Umumiy sahifadan) | mavjud tizim saqlandi | Yordamsiz test; natijaga kuchli/zaif yo'nalishlar va "qo'shimcha diagnostika kerak" xabari qo'shildi |
| Imtihon simulyatsiyasi | `/imtihon` | mavjud tizim saqlandi | To'liq ekran, taymer. "Trening simulyatsiyasi" deb belgilandi: rasmiy profil yo'q |

## Dvigatel
- `TestSession.config`: rejim, siyosat (`instant`/`deferred`), taymer (soniya), savollar tartibi, javoblar (`answers`), belgilar (`flags`), taqsimot, variant.
- **instant** (oddiy, mavzuli, vaziyatli, xatolar): `POST answer` darhol tekshiradi.
- **deferred** (vaqtli, aralash): `POST save` tanlovni atomik (jsonb) saqlaydi, kalit yuborilmaydi; `POST finish` yoki taymer tugashi serverda baholaydi. Holat tranzaksiyada "egallanadi", shuning uchun takroriy yuborish balni ikki marta hisoblamaydi.
- Taymer: `startedAt + durationSec` server soati bo'yicha; sahifa yangilanganda qayta boshlanmaydi; har so'rovda muddat tekshiriladi.
- Yangi test boshlansa, eskisi yopiladi; yakunda tekshiriladigan eski testning saqlangan javoblari baholanadi (yo'qolmaydi).

## Bazaga qo'shilganlar (faqat qo'shimcha)
`TestMode.SITUATIONAL`, `Question.skill`, `Question.kind`, `Topic.objectives`, `UserAnswer.rationale`. SQL: `prisma/supabase-update-tests2.sql`, migratsiya `20261021100000_tests2`.

## API (`/api/practice/...`)
`start` (kind: quick, topic, ai, timed, topictest, mixed, situational, errors), `[id]`, `[id]/answer`, `[id]/save`, `[id]/flag`, `[id]/hint`, `[id]/explain` (why, simple, example, variants, mistake, tutor, rationale), `[id]/reinforce`, `[id]/reinforce/answer`, `[id]/finish`, `home`, `topics`, `history?kind=&subject=&days=`, `errors`, `map`, `report`.
Admin: `/api/admin/qbank`, `/api/admin/topics/[id]` (PATCH: o'quv maqsadlari).

## Tekshirilgan
Birlik testlari (171): server tekshiruvi, takroriy so'rov, yakunda baholash, taymer muddati, taqsimot, tavsiya, AI javob sxemalari, vaziyatli savollar sifati (variant uzunligi muvozanati). Brauzerda: Testlar bosh sahifa, sozlash, vaqtli va aralash test, vaziyatli test, natija, tarix, mobil va qorong'u rejim.

## Hozircha cheklangan
- Fan → bo'lim → mavzu → kichik mavzu zanjiri yo'q: ma'lumotlar modelida faqat fan va mavzu bor (kichik mavzu o'rniga "ko'nikma" belgisi ishlatiladi).
- Rasmiy imtihon profillari (attestatsiya, milliy sertifikat) yo'q: tasdiqlangan rasmiy spetsifikatsiya bo'lmagani uchun hammasi "trening simulyatsiyasi".
- Diagnostikada fan tanlash yo'q (mavjud tizim saqlandi); imtihon natijasida mavzu kesimidagi tahlil cheklangan.
- AI savol generatsiyasi faqat talab bo'yicha (mustahkamlovchi savol, `DRAFT`, ekspert tasdig'isiz). Admin uchun ommaviy AI generatsiya va noto'g'ri variantlar uchun alohida izohlar saqlanmagan.
- Savollar bazasi kichik: namunaviy savollar "Namunaviy savol" deb belgilangan; haqiqiy savollar admin paneldan kiritilishi kerak.
- AI so'rovlari uchun faqat kunlik limit bor (daqiqalik rate limit yo'q).
- Playwright/E2E testlar yozilmagan; ekran o'qish dasturlari bilan qo'lda sinalmagan.
