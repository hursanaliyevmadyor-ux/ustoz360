# Bo'limlar xaritasi

Modullar tab qatorisiz ochiladi: modulning o'zi (umumiy sahifa, tanlash kartalari) turadi, joylashuv yo'l ko'rsatkichida ko'rinadi: **Bosh sahifa > DARSYOR > Dars ishlanmasi**. Har modulda eng ko'pi bilan to'rtta bo'lim bor, o'xshash sahifalar birlashtirilgan, ichidagilari tanlash kartalari (`ChoiceCard`) yoki sahifadagi tugmalar orqali ochiladi (USTOZ MARKET, SINF ANALITIKA va BILIMXONA'da sahifa tepasidagi tugmalar). Admin panelida bo'limlar ko'p bo'lgani uchun tab qatori saqlangan. Eski manzillar yo'naltiriladi (redirect), hech narsa buzilmaydi. Quyidagi jadvaldagi "Tablar" ustuni shu bo'limlar ro'yxati.

| Modul | Tablar | Birlashtirilgan / o'zgargan |
|---|---|---|
| **USTOZ AI** | Umumiy, Testlar, Natijalarim | Diagnostika Umumiyda; Oddiy mashq Testlar ichida; Bilim xaritasi, Xatolar daftari va tarix Natijalarim ichida. [TESTLAR-2.md](TESTLAR-2.md) |
| **DARSYOR** | Umumiy, Dars ishlanmasi, Materiallar | Test generatori, Ko'rgazmali materiallar va Baholash alohida tab emas, Materiallar ichida. SINF'dagi "Individual topshiriqlar" Test generatoriga yo'naltiriladi (ikki o'xshash bo'lim bo'lmasligi uchun) |
| **TOIFA NAVIGATOR** | Umumiy, Reja, Hujjatlar | Yo'l xaritasi, Kalendar va Kunlik reja bitta "Reja" bo'limida (ichki tablar). USTOZ AI'dagi "Shaxsiy reja" ham shu yerga ko'chirildi. Hammasi haqiqiy: maqsad profildan, reja qoidalar bilan natijalardan tuziladi, cheklist bazada, rasmiy ma'lumotni admin manba bilan kiritadi |
| **USTOZ MARKET** | Katalog, Kurslarim va xaridlar, Muallif kabineti | "Mening kurslarim" va "Xaridlar" bitta sahifa. Katalog faqat tasdiqlangan kurslar; kirish to'lov tasdig'idan keyin |
| **SINF ANALITIKA** | Sinflar, Tahlil va natijalar | "Natijalar" va "Tahlil" bitta sahifa (ichki tablar: Natijalar, Tahlil, Oldin/keyin, O'quvchilar); "Individual topshiriqlar" DARSYOR'ga |
| **BILIMXONA** | Kutubxona, Hujjat bilan suhbat | "Fayl yuklash" alohida tab emas (Kutubxona ichida). Fayl Supabase Storage'da; ulanmagan bo'lsa yuklash halol xabar bilan o'chirilgan |
| **BEPUL AI** | Umumiy, Mening AI obunalarim | Ikkinchi chat olib tashlandi: bitta umumiy AI suhbat (`/ai`) bor. Bu bo'lim bepul AI holatini ko'rsatadi va uni ochadi |

Yon menyu: Bosh sahifa, USTOZ AI, Seminarlar, Modullar (yuqoridagilar), Boshqaruv. Imtihon simulyatori va Bilim laboratoriyasi USTOZ AI → Testlar ichida.

Umumiy komponentlar: `src/lib/choices.ts` (kartalar tuzilmasi), `src/components/layout/choice-card.tsx`, `section-header.tsx`; bo'lim kartalari: `src/lib/hubs.ts` (modullar), `src/components/tests/modes.ts` (USTOZ AI). Tab va yo'l ko'rsatkichi mantiqi: `resolveSub` (`src/lib/modules.ts`, testlangan).

Admin panelida hozir 12 bo'lim: Dashboard, Imtihonlar, Mavzular, Seminarlar, Foydalanuvchilar, Savollar banki, Kurslar, Kutubxona, Rasmiy ma'lumotlar, To'lovlar, Hisobotlar, Sozlamalar. Namunaviy (demo) sahifa qolmagan; kirmagan foydalanuvchi so'rasagina "NAMUNA" belgisi bilan ko'rsatiladigan ko'rinish bor. To'liq holat: [PLATFORMA.md](PLATFORMA.md).
