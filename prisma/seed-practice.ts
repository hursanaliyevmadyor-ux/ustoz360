/**
 * Mashq (Bilim laboratoriyasi) uchun NAMUNAVIY savollar. Ekspert tekshirmagan: isDemo=true, source=SAMPLE.
 * Mashq ekranida "Namunaviy savol" deb belgilanadi. Haqiqiy savollar admin panel orqali kiritiladi.
 * Ko'p marta ishga tushirsa ham xavfsiz: mavjud savol qayta yaratilmaydi, faqat super kalit/izoh yangilanadi.
 *   npm run db:seed-practice
 */
import { PrismaClient } from "@prisma/client";
import { SITUATIONAL as S } from "./situational-data";
const db = new PrismaClient();

type L = "EASY" | "MEDIUM" | "HARD";
// [mavzu slug, qiyinlik, savol, variantlar, to'g'ri variant indeksi, izoh, super kalit]
const Q: [string, L, string, string[], number, string, string][] = [
  // Formativ baholash
  ["formativ-baholash", "EASY", "Formativ baholash qachon o'tkaziladi?", ["Faqat o'quv yili oxirida", "O'qitish jarayoni davomida, muntazam", "Faqat chorak yakunida", "Faqat imtihon paytida"], 1,
    "Formativ baholash o'qitish davomida o'tkaziladi: u o'quvchi va o'qituvchiga keyingi qadam uchun qayta aloqa beradi.", "Formativ — yo'lda yo'nalish berish; summativ — marradagi xulosa."],
  ["formativ-baholash", "MEDIUM", "Qaysi holat formativ baholashga misol bo'ladi?", ["Yillik yakuniy imtihon", "Dars oxirida «chiqish bileti» javoblarini ko'rib, ertangi darsni moslashtirish", "Chorak oxirida ball qo'yish", "Yil yakunidagi test natijasini jurnalga yozish"], 1,
    "Bu yerda natija darhol keyingi o'qitishni moslashtirish uchun ishlatilyapti. Formativ baholashning mohiyati ham shunda.", "Natija o'qitishni o'zgartirsa, bu formativ baholash."],
  ["formativ-baholash", "MEDIUM", "Qaysi qayta aloqa o'quvchi uchun eng foydali?", ["«Yaxshi» yoki «yomon» degan umumiy baho", "Nima yaxshi bo'lgani va keyingi qadam aniq ko'rsatilgan fikr", "Faqat ball", "Boshqa o'quvchilar bilan solishtirish"], 1,
    "Aniq va amaliy qayta aloqa o'quvchiga nimani saqlab qolish va nimani yaxshilashni ko'rsatadi.", "Yaxshi qayta aloqa: nima yaxshi + keyingi qadam."],
  ["formativ-baholash", "HARD", "Formativ baholash natijasiga ko'ra sinfning ko'pchiligi mavzuni tushunmagani aniqlandi. Eng maqbul harakat qaysi?", ["Dasturdan orqada qolmaslik uchun keyingi mavzuga o'tish", "Mavzuni boshqacha usulda qayta tushuntirib, qisqa mashq bilan tekshirish", "Hammaga past ball qo'yish", "Uy vazifasini ko'paytirish"], 1,
    "Formativ baholashning maqsadi aynan shu: tushunmovchilik topilganda o'qitishni darhol moslashtirish.", "Tushunmovchilik topildimi, o'qitishni o'zgartiring."],

  // Pedagogik mahorat
  ["pedagogik-mahorat", "EASY", "Dars maqsadi nimani ifodalashi kerak?", ["O'qituvchi nima qilishini", "O'quvchi dars oxirida nimaga erishishini", "Darslik betlari sonini", "Dars davomiyligini"], 1,
    "Maqsad o'quvchi nimani bilishi yoki qila olishini o'lchanadigan tarzda ko'rsatadi.", "Maqsad: o'quvchi nima qila oladi?"],
  ["pedagogik-mahorat", "MEDIUM", "Qaysi savol o'quvchini fikrlashga ko'proq undaydi?", ["Poytaxtimiz qaysi shahar?", "Nima uchun yozda kun uzun, qishda qisqa bo'ladi? Fikringizni asoslang.", "2 + 2 nechaga teng?", "Bugun haftaning qaysi kuni?"], 1,
    "«Nima uchun?» va «asoslang» kabi savollar yodlashdan ko'ra tushunish va izoh berishni talab qiladi.", "«Nima uchun?» va «qanday?» savollari fikrlashni ochadi."],
  ["pedagogik-mahorat", "MEDIUM", "Sinfda ikki o'quvchi bir-biriga xalaqit bermoqda. Eng samarali dastlabki qadam qaysi?", ["Darhol sinfdan chiqarib yuborish", "Darsni to'xtatmay, yaqinlashib yoki qisqa ko'rsatma bilan e'tiborni qaytarish", "Ota-onasini darhol chaqirish", "E'tibor bermaslik"], 1,
    "Kichik va bezovta qilmaydigan choralar avval qo'llaniladi: dars ritmi buzilmaydi va o'quvchi obro'si saqlanadi.", "Avval yengil chora, keyin jiddiyroq."],
  ["pedagogik-mahorat", "EASY", "O'quvchilarni guruhlarda ishlatishning asosiy foydasi nima?", ["O'qituvchi dam oladi", "Hamkorlikda o'rganish va fikr almashish", "Dars vaqti qisqaradi", "Baholash shart bo'lmaydi"], 1,
    "Guruhda o'quvchilar bir-biriga tushuntiradi, fikr almashadi va muloqot ko'nikmasini rivojlantiradi.", "Guruh ishi: birga o'rganish."],
  ["pedagogik-mahorat", "HARD", "O'quvchi noto'g'ri javob berdi. O'qituvchining eng foydali reaksiyasi qaysi?", ["«Noto'g'ri» deb, keyingi o'quvchidan so'rash", "Qanday o'ylaganini so'rab, fikrlash yo'lidagi nuqtani topish", "Darhol to'g'ri javobni aytib qo'yish", "Boshqa o'quvchilar oldida kulib qo'yish"], 1,
    "Xatoning sababi ko'pincha fikrlash yo'lida bo'ladi. Uni so'rash orqali o'qituvchi to'g'ri joyda yordam beradi.", "Avval o'quvchining fikrlash yo'lini eshiting."],

  // Matematika metodikasi
  ["matematika-metodikasi", "EASY", "Ko'paytirish jadvalini tushunib o'rganishda eng yaxshi dastlabki yondashuv qaysi?", ["Faqat yodlatish", "Bir xil guruhlarni takroriy qo'shish bilan bog'lash", "Hisoblagichdan foydalanishni taqiqlash", "Faqat yozma mashq berish"], 1,
    "3 × 4 — to'rttadan uch guruh: 4 + 4 + 4. Ma'noni tushungan o'quvchi jadvalni oson eslab qoladi.", "Ko'paytirish — bir xil guruhlarni qo'shish."],
  ["matematika-metodikasi", "MEDIUM", "Kasrlarni solishtirishni o'rgatishda nega bo'lingan chiziq yoki doira modeli ishlatiladi?", ["Vaqtni qisqartirish uchun", "Mavhum tushunchani ko'rib, qismlar nisbatini anglash uchun", "Qoidani yodlatish uchun", "Faqat bezak uchun"], 1,
    "Ko'rgazmali model kasr qismlarining kattaligini ko'z bilan solishtirishga imkon beradi va keyin qoidaga o'tish oson bo'ladi.", "Avval ko'rsating, keyin qoida."],
  ["matematika-metodikasi", "MEDIUM", "«12 : 3 = 4» tengligini tekshirishning to'g'ri usuli qaysi?", ["4 + 3 = 7", "4 × 3 = 12", "12 − 3 = 9", "12 + 4 = 16"], 1,
    "Bo'lish ko'paytirishga teskari amal, shuning uchun natijani bo'luvchiga ko'paytirib, bo'linuvchi chiqishini tekshiramiz.", "Bo'lishni ko'paytirish bilan tekshiring."],
  ["matematika-metodikasi", "HARD", "O'quvchi masalada sonlarni ko'rib, tasodifan amal tanlayapti. Metodik jihatdan eng maqbul yordam qaysi?", ["Ko'proq o'xshash masalalar berish", "Masala mazmunini chizma yoki qisqa yozuv bilan modellashtirib, nima so'ralayotganini aniqlash", "Amallarni yodlatish", "Masalalarni o'tkazib yuborish"], 1,
    "Tasodifan tanlash masala mazmuni tushunilmaganini bildiradi. Modellashtirish mazmunni ko'rinadigan qiladi.", "Avval masala mazmunini tushuning, keyin amalni tanlang."],
  ["matematika-metodikasi", "EASY", "Nol raqami haqida qaysi fikr to'g'ri?", ["Biror songa 0 qo'shsak, son o'zgarmaydi", "Biror sonni 0 ga ko'paytirsak, o'sha son qoladi", "0 ga bo'lish mumkin", "0 dan katta har qanday son manfiy"], 0,
    "a + 0 = a. Nolga ko'paytirganda natija 0 bo'ladi, nolga bo'lish esa mumkin emas.", "a + 0 = a, a × 0 = 0, nolga bo'lib bo'lmaydi."],

  // Kasb standarti (umumiy kasbiy yondashuvlar; me'yoriy hujjat raqamlarisiz)
  ["kasb-standarti", "EASY", "Refleksiya o'qituvchiga nima beradi?", ["Dars tezroq tugaydi", "O'z faoliyatini tahlil qilib, keyingi darsni yaxshilash imkoni", "Jurnalni to'ldirish osonlashadi", "Baholar avtomatik oshadi"], 1,
    "Refleksiya — o'z ishini tahlil qilish. U kuchli va kuchsiz tomonlarni ko'rsatib, keyingi qadamni belgilashga yordam beradi.", "Refleksiya: nima bo'ldi, nega, keyin nima qilaman?"],
  ["kasb-standarti", "MEDIUM", "Kasbiy rivojlanish rejasi qanday bo'lsa samarali?", ["Har yili bir xil kursga borish", "Aniq maqsad, qadam va muddatga ega, o'z faoliyatini tahlil qilishga tayangan", "Faqat sertifikat sonini ko'paytirish", "Boshqa o'qituvchining rejasini ko'chirish"], 1,
    "Samarali reja o'qituvchining o'z ehtiyojidan kelib chiqadi va tekshiriladigan qadamlardan iborat bo'ladi.", "Reja: maqsad + qadam + muddat."],
  ["kasb-standarti", "MEDIUM", "Hamkasbning darsini kuzatishning (o'zaro kuzatuv) asosiy maqsadi nima?", ["Xatolarni topib rahbarga xabar qilish", "Bir-biridan o'rganish va tajriba almashish", "Reyting tuzish", "Hamkasbni baholash"], 1,
    "O'zaro kuzatuv baholash emas, hamkorlikda o'rganish vositasi.", "Kuzatuv — o'rganish uchun, baholash uchun emas."],
  ["kasb-standarti", "HARD", "Yangi usul sinab ko'rildi, natija kutilganidek chiqmadi. Kasbiy yondashuv qaysi?", ["Usulni butunlay tashlab, boshqasiga o'tish", "Natijani tahlil qilib, nimani o'zgartirish mumkinligini aniqlab, qayta sinash", "Aybni o'quvchilarga yuklash", "Hech narsa qilmaslik"], 1,
    "Kasbiy o'sish sinash, tahlil qilish va moslashtirish aylanasi orqali kechadi.", "Sinab ko'r, tahlil qil, moslashtir."],

  // Inklyuziv ta'lim
  ["inklyuziv-talim", "EASY", "Inklyuziv ta'limning asosiy g'oyasi nima?", ["Alohida sinflarga ajratish", "Barcha o'quvchilar uchun o'rganish imkoniyatini yaratish", "Faqat iqtidorlilarga e'tibor berish", "Hammaga bir xil topshiriq berish"], 1,
    "Inklyuziv ta'lim har bir bolaning ehtiyojini inobatga olib, hammaga birga o'rganish imkonini beradi.", "Inklyuziya: hamma uchun imkoniyat."],
  ["inklyuziv-talim", "MEDIUM", "Sinfda o'qish tezligi turlicha o'quvchilar bor. Qaysi yondashuv mos?", ["Hammaga bir xil vaqt va bir xil topshiriq", "Maqsad bir, murakkablik va yordam darajasi turlicha topshiriqlar", "Sekin o'quvchilarni faol ishtirokdan chetlatish", "Tez o'quvchilarga faqat ko'proq uy vazifasi"], 1,
    "Differensiatsiyada maqsad bir xil, unga yetish yo'llari esa o'quvchiga moslashtiriladi.", "Maqsad bir, yo'llar turlicha."],
  ["inklyuziv-talim", "MEDIUM", "Ko'rish qobiliyati cheklangan o'quvchi uchun qaysi moslashuv foydali?", ["Katta shriftli, yuqori kontrastli materiallar va og'zaki izoh", "Faqat kichik shriftli matn", "Doskadagi yozuvni ko'chirishni talab qilish", "Hech narsani o'zgartirmaslik"], 0,
    "Katta shrift, kontrast va og'zaki izoh o'quvchining materialga kirish imkonini oshiradi.", "Materialni o'quvchiga moslang."],
  ["inklyuziv-talim", "HARD", "O'quvchi ko'p jim turadi va guruh ishida qatnashmaydi. Birinchi navbatda nima ma'qul?", ["Jazolash", "Sababini xotirjam o'rganib (kuzatish, suhbat), unga mos rol va qo'llab-quvvatlash berish", "Guruhdan chiqarib yuborish", "Ota-onasiga shikoyat qilish"], 1,
    "Jimlik sababi turlicha bo'lishi mumkin (uyatchanlik, tushunmaslik, til muammosi). Sababni bilmasdan chora ko'rish samarasiz.", "Avval sababni toping, keyin yordam bering."],
];

// Oldingi namunaviy (DEMO) savollarga ham super kalit qo'shiladi.
const KEYS: [string, string][] = [
  ["Formativ baholashning asosiy maqsadi nima?", "Formativ baholash o'rganishni yo'naltiradi, ball qo'ymaydi."],
  ["Dars maqsadi qaysi holatda to'g'ri qo'yilgan?", "Maqsad o'lchanadigan fe'l bilan, o'quvchi nuqtai nazaridan yoziladi."],
  ["Bo'lish amalini tushunishda ko'paytirish bilan bog'liqlik nimani bildiradi?", "Bo'lish — ko'paytirishga teskari amal."],
  ["Qaysi holat o'qituvchining kasbiy rivojlanish talabiga to'g'ri keladi?", "Refleksiya + reja = kasbiy o'sish."],
  ["Differensial topshiriqlar nima uchun beriladi?", "Maqsad bir, yo'llar turlicha."],
];

// Savol matni -> tekshiriladigan ko'nikma/tushuncha (xatolar testi va tahlil uchun).
const SKILL: Record<string, string> = {
  "Formativ baholash qachon o'tkaziladi?": "formativ va summativ baholashni farqlash",
  "Qaysi holat formativ baholashga misol bo'ladi?": "formativ va summativ baholashni farqlash",
  "Formativ baholashning asosiy maqsadi nima?": "formativ va summativ baholashni farqlash",
  "Qaysi qayta aloqa o'quvchi uchun eng foydali?": "qayta aloqa berish",
  "Formativ baholash natijasiga ko'ra sinfning ko'pchiligi mavzuni tushunmagani aniqlandi. Eng maqbul harakat qaysi?": "baholash natijasiga ko'ra o'qitishni moslashtirish",
  "Dars maqsadi nimani ifodalashi kerak?": "dars maqsadini to'g'ri qo'yish",
  "Dars maqsadi qaysi holatda to'g'ri qo'yilgan?": "dars maqsadini to'g'ri qo'yish",
  "Qaysi savol o'quvchini fikrlashga ko'proq undaydi?": "savol berish texnikasi",
  "Sinfda ikki o'quvchi bir-biriga xalaqit bermoqda. Eng samarali dastlabki qadam qaysi?": "sinf boshqaruvi",
  "O'quvchilarni guruhlarda ishlatishning asosiy foydasi nima?": "hamkorlikda o'rganish",
  "O'quvchi noto'g'ri javob berdi. O'qituvchining eng foydali reaksiyasi qaysi?": "xatoga pedagogik munosabat",
  "Ko'paytirish jadvalini tushunib o'rganishda eng yaxshi dastlabki yondashuv qaysi?": "amallar ma'nosini tushuntirish",
  "Kasrlarni solishtirishni o'rgatishda nega bo'lingan chiziq yoki doira modeli ishlatiladi?": "ko'rgazmalilik",
  "«12 : 3 = 4» tengligini tekshirishning to'g'ri usuli qaysi?": "amallar ma'nosini tushuntirish",
  "Bo'lish amalini tushunishda ko'paytirish bilan bog'liqlik nimani bildiradi?": "amallar ma'nosini tushuntirish",
  "O'quvchi masalada sonlarni ko'rib, tasodifan amal tanlayapti. Metodik jihatdan eng maqbul yordam qaysi?": "masala yechishni o'rgatish",
  "Nol raqami haqida qaysi fikr to'g'ri?": "nol bilan amallar",
  "Refleksiya o'qituvchiga nima beradi?": "refleksiya",
  "Yangi usul sinab ko'rildi, natija kutilganidek chiqmadi. Kasbiy yondashuv qaysi?": "refleksiya",
  "Kasbiy rivojlanish rejasi qanday bo'lsa samarali?": "kasbiy rivojlanishni rejalashtirish",
  "Qaysi holat o'qituvchining kasbiy rivojlanish talabiga to'g'ri keladi?": "kasbiy rivojlanishni rejalashtirish",
  "Hamkasbning darsini kuzatishning (o'zaro kuzatuv) asosiy maqsadi nima?": "hamkorlikda kasbiy o'sish",
  "Inklyuziv ta'limning asosiy g'oyasi nima?": "inklyuziv ta'lim tamoyillari",
  "Sinfda o'qish tezligi turlicha o'quvchilar bor. Qaysi yondashuv mos?": "differensiatsiya",
  "Differensial topshiriqlar nima uchun beriladi?": "differensiatsiya",
  "Ko'rish qobiliyati cheklangan o'quvchi uchun qaysi moslashuv foydali?": "moslashtirilgan materiallar",
  "O'quvchi ko'p jim turadi va guruh ishida qatnashmaydi. Birinchi navbatda nima ma'qul?": "o'quvchi ehtiyojini aniqlash",
};

// Mavzu maqsadlari ("Bu mavzuda nimalarni bilib olasiz?").
const OBJECTIVES: Record<string, string[]> = {
  "formativ-baholash": ["Formativ va summativ baholashni farqlash", "Aniq va foydali qayta aloqa berish", "Baholash natijasiga qarab darsni moslashtirish"],
  "pedagogik-mahorat": ["Dars maqsadini o'quvchi nuqtai nazaridan qo'yish", "Fikrlashga undaydigan savollar berish", "Sinfda tartibni yengil choralar bilan saqlash"],
  "matematika-metodikasi": ["Amallarning ma'nosini ko'rgazmali tushuntirish", "Masala yechishni modellashtirish orqali o'rgatish", "Xato ortidagi tushunmovchilikni topish"],
  "kasb-standarti": ["Refleksiya orqali o'z faoliyatini tahlil qilish", "Kasbiy rivojlanish rejasini aniq maqsad bilan tuzish", "Hamkasblar bilan o'zaro o'rganish"],
  "inklyuziv-talim": ["Inklyuziv ta'lim tamoyillarini tushunish", "Topshiriqlarni turli ehtiyojlarga moslashtirish (differensiatsiya)", "O'quvchi ehtiyojini avval aniqlab, keyin yordam berish"],
};

async function main() {
  let created = 0, updated = 0;
  for (const [slug, level, text, opts, a, why, key] of Q) {
    const topic = await db.topic.findUnique({ where: { slug } });
    if (!topic) { console.warn(`Mavzu topilmadi: ${slug} (avval npm run db:seed ishga tushiring)`); continue; }
    const ex = await db.question.findFirst({ where: { topicId: topic.id, text } });
    if (ex) { await db.question.update({ where: { id: ex.id }, data: { explanation: why, superKey: key } }); updated++; continue; }
    await db.question.create({
      data: {
        topicId: topic.id, text, explanation: why, superKey: key, difficulty: level, status: "APPROVED", isDemo: true, source: "SAMPLE", sourceRef: "Namunaviy savol: ekspert tekshirmagan",
        options: { create: opts.map((t, i) => ({ text: t, isCorrect: i === a, position: i })) },
      },
    });
    created++;
  }
  for (const [text, superKey] of KEYS) await db.question.updateMany({ where: { text, isDemo: true }, data: { superKey, source: "SAMPLE" } });

  // Vaziyatli savollar (kind=SITUATIONAL).
  let situational = 0;
  for (const [slug, level, text, opts, a, why, key, skill] of S) {
    const topic = await db.topic.findUnique({ where: { slug } });
    if (!topic) continue;
    const ex = await db.question.findFirst({ where: { topicId: topic.id, text } });
    if (ex) {
      await db.question.update({ where: { id: ex.id }, data: { explanation: why, superKey: key, skill, kind: "SITUATIONAL" } });
      // Variantlar matni yangilangan bo'lishi mumkin: o'rni bo'yicha yangilanadi (id lar saqlanadi).
      const cur = await db.answerOption.findMany({ where: { questionId: ex.id }, orderBy: { position: "asc" } });
      for (let i = 0; i < opts.length; i++) if (cur[i]) await db.answerOption.update({ where: { id: cur[i].id }, data: { text: opts[i], isCorrect: i === a } });
      continue;
    }
    await db.question.create({
      data: {
        topicId: topic.id, text, explanation: why, superKey: key, skill, kind: "SITUATIONAL", difficulty: level, status: "APPROVED", isDemo: true, source: "SAMPLE", sourceRef: "Namunaviy savol: ekspert tekshirmagan",
        options: { create: opts.map((t, i) => ({ text: t, isCorrect: i === a, position: i })) },
      },
    });
    situational++;
  }

  // Ko'nikmalar va mavzu maqsadlari.
  for (const [text, skill] of Object.entries(SKILL)) await db.question.updateMany({ where: { text, skill: null }, data: { skill } });
  for (const [slug, objectives] of Object.entries(OBJECTIVES)) await db.topic.updateMany({ where: { slug, objectives: { isEmpty: true } }, data: { objectives } });
  console.log(`Namunaviy savollar: ${created} ta yaratildi, ${updated} ta yangilandi; vaziyatli: ${situational} ta yaratildi.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
