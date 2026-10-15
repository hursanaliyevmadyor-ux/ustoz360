/** Barcha ma'lumotlar NAMUNAVIY (demo). Hech biri haqiqiy foydalanuvchi, test yoki rasmiy ma'lumot emas. */
export const user = { name: "Dilnoza Karimova", short: "DK", role: "Boshlang'ich sinf o'qituvchisi", plan: "PRO" as const };

export const notifications = [
  { id: 1, title: "Takrorlash vaqti", text: "Bugun 4 ta xato kartochkasini takrorlang.", time: "10 daqiqa oldin", unread: true },
  { id: 2, title: "Reja yangilandi", text: "Diagnostika natijasiga ko'ra bugungi vazifalar o'zgardi.", time: "1 soat oldin", unread: true },
  { id: 3, title: "Obuna", text: "PRO obunangiz 12 kundan so'ng tugaydi.", time: "Kecha", unread: false },
];

export const todayTasks = [
  { id: "t1", title: "Formativ baholash: qisqa nazariya", meta: "15 daqiqa", module: "ai" },
  { id: "t2", title: "Mavzuli test: Kasb standarti (10 savol)", meta: "20 daqiqa", module: "ai" },
  { id: "t3", title: "Xatolarni takrorlash (4 ta)", meta: "10 daqiqa", module: "ai" },
  { id: "t4", title: "Hujjatlar cheklistini to'ldirish", meta: "15 daqiqa", module: "toifa" },
];

export const topics = [
  { name: "Pedagogik mahorat", score: 82, answered: 9, conf: "yuqori" },
  { name: "Kasb standarti", score: 64, answered: 7, conf: "o'rta" },
  { name: "Formativ baholash", score: 48, answered: 6, conf: "o'rta" },
  { name: "Matematika metodikasi", score: 45, answered: 5, conf: "o'rta" },
  { name: "Ta'lim qonunchiligi", score: 71, answered: 2, conf: "past" },
  { name: "Inklyuziv ta'lim", score: 58, answered: 1, conf: "past" },
];

export const mistakes = [
  { id: 1, q: "Formativ va diagnostik baholash farqi qaysi javobda to'g'ri ko'rsatilgan?", topic: "Formativ baholash", date: "12-okt", count: 3, next: "Bugun", status: "Takrorlash kerak" },
  { id: 2, q: "Ko'paytirishni o'rgatishda qaysi bosqich birinchi bo'ladi?", topic: "Matematika metodikasi", date: "11-okt", count: 2, next: "Ertaga", status: "Takrorlash kerak" },
  { id: 3, q: "Kasb standartida o'qituvchining qaysi kompetensiyasi ko'rsatilgan?", topic: "Kasb standarti", date: "9-okt", count: 1, next: "3 kundan so'ng", status: "O'zlashtirilmoqda" },
  { id: 4, q: "Inklyuziv sinfda differensial topshiriq maqsadi nima?", topic: "Inklyuziv ta'lim", date: "7-okt", count: 1, next: "—", status: "O'zlashtirildi" },
];

export const demoQuestions = [
  { id: 1, topic: "Formativ baholash", level: "Oson", q: "Formativ baholashning asosiy maqsadi nima?", opts: ["O'quv yili oxirida yakuniy ball qo'yish", "O'qitish jarayonida qayta aloqa berib, o'rganishni yo'naltirish", "O'quvchilarni reytingga qo'yish", "Faqat uy vazifasini tekshirish"], a: 1, why: "Formativ baholash jarayon davomida o'qituvchi va o'quvchiga keyingi qadam uchun ma'lumot beradi." },
  { id: 2, topic: "Pedagogik mahorat", level: "O'rta", q: "Dars maqsadi qaysi holatda to'g'ri qo'yilgan?", opts: ["Mavzuni tushuntirish", "O'quvchi kasrlarni solishtira oladi", "Darslikning 12-betini o'qish", "Dars vaqtida tartib saqlash"], a: 1, why: "Maqsad o'quvchi nimaga erishishini o'lchanadigan fe'l bilan ifodalashi kerak." },
  { id: 3, topic: "Matematika metodikasi", level: "O'rta", q: "Bo'lish amalini tushunishda ko'paytirish bilan bog'liqlik nimani bildiradi?", opts: ["Ular bir-biriga bog'liq emas", "Bo'lish — ko'paytirishga teskari amal", "Bo'lish faqat qoldiqli bo'ladi", "Ko'paytirish bo'lishdan keyin o'rganiladi"], a: 1, why: "Bo'lish ko'paytirishga teskari amal: 12 : 3 = 4, chunki 3 × 4 = 12." },
  { id: 4, topic: "Kasb standarti", level: "Murakkab", q: "Qaysi holat o'qituvchining kasbiy rivojlanish talabiga to'g'ri keladi?", opts: ["Bir marta kursga borib, qayta o'qimaslik", "O'z faoliyatini tahlil qilib, rejali malaka oshirish", "Faqat sertifikat to'plash", "Boshqalarning dars rejasini ko'chirish"], a: 1, why: "Kasbiy rivojlanish refleksiya va rejali o'sishga asoslanadi." },
  { id: 5, topic: "Inklyuziv ta'lim", level: "Oson", q: "Differensial topshiriqlar nima uchun beriladi?", opts: ["Bir xil topshiriq berish uchun", "Turli tayyorgarlikdagi o'quvchilar bir maqsadga erishishi uchun", "O'quvchilarni guruhlarga bo'lib ajratish uchun", "Vaqtni qisqartirish uchun"], a: 1, why: "Maqsad bir, yo'llar va murakkablik darajasi turlicha." },
];

export const plan = [
  { day: "1-kun", title: "Formativ baholash asoslari", parts: ["Qisqa nazariya", "8 savollik test", "Xatolar tahlili"], done: true },
  { day: "2-kun", title: "Matematika metodikasi: ko'paytirish", parts: ["Qisqa nazariya", "10 savollik test", "Takrorlash"], done: true },
  { day: "3-kun", title: "Kasb standarti kompetensiyalari", parts: ["Qisqa nazariya", "Mavzuli test", "Xatolar tahlili"], done: false },
  { day: "4-kun", title: "Inklyuziv ta'lim", parts: ["Qisqa nazariya", "Vaziyatli test"], done: false },
  { day: "5-kun", title: "Takrorlash kuni", parts: ["Xatolar testi", "Zaif mavzular"], done: false },
];

export const courses = [
  { id: 1, title: "Attestatsiyaga to'liq tayyorlov", author: "Namunaviy muallif A", price: 189000, rating: 4.8, lessons: 24, subject: "Umumiy", tag: "Videokurs" },
  { id: 2, title: "Boshlang'ich sinf: matematika metodikasi", author: "Namunaviy muallif B", price: 129000, rating: 4.6, lessons: 16, subject: "Matematika", tag: "Videokurs" },
  { id: 3, title: "Formativ baholash test to'plami (300 savol)", author: "Namunaviy muallif C", price: 59000, rating: 4.5, lessons: 0, subject: "Umumiy", tag: "Test to'plami" },
  { id: 4, title: "Dars ishlanmalari: 3-sinf ona tili", author: "Namunaviy muallif D", price: 79000, rating: 4.4, lessons: 0, subject: "Ona tili", tag: "Dars ishlanmasi" },
  { id: 5, title: "Milliy sertifikat: intensiv 14 kun", author: "Namunaviy muallif E", price: 249000, rating: 4.9, lessons: 14, subject: "Umumiy", tag: "Intensiv" },
  { id: 6, title: "Mentorlik: individual yo'naltirish", author: "Namunaviy muallif F", price: 399000, rating: 4.7, lessons: 0, subject: "Umumiy", tag: "Mentorlik" },
];

export const classes = [
  { id: "c1", name: "3-A sinf", subject: "Matematika", students: 28, avg: 71, trend: [62, 64, 66, 69, 71] },
  { id: "c2", name: "3-B sinf", subject: "Matematika", students: 26, avg: 64, trend: [60, 61, 59, 63, 64] },
  { id: "c3", name: "4-A sinf", subject: "Ona tili", students: 30, avg: 78, trend: [70, 72, 75, 77, 78] },
];
export const classTopics = [
  { name: "Qo'shish va ayirish", v: 88 }, { name: "Ko'paytirish", v: 74 }, { name: "Bo'lish", v: 49 },
  { name: "Kasrlar", v: 41 }, { name: "Masalalar yechish", v: 62 },
];
export const students = [
  { id: "S-01", alias: "Oybek", score: 82, weak: "—", trend: "o'sish" },
  { id: "S-02", alias: "Malika", score: 54, weak: "Bo'lish", trend: "barqaror" },
  { id: "S-03", alias: "Jasur", score: 67, weak: "Kasrlar", trend: "o'sish" },
  { id: "S-04", alias: "Nilufar", score: 38, weak: "Bo'lish, kasrlar", trend: "yordam kerak" },
  { id: "S-05", alias: "Sardor", score: 75, weak: "Masalalar", trend: "o'sish" },
];

export const documents = [
  { id: "d1", name: "Matematika 3-sinf darsligi.pdf", type: "PDF", size: "8.4 MB", pages: 168, date: "10-okt" },
  { id: "d2", name: "Pedagogik mahorat konspekti.docx", type: "DOCX", size: "1.2 MB", pages: 34, date: "8-okt" },
  { id: "d3", name: "Kasb standarti qisqacha.txt", type: "TXT", size: "92 KB", pages: 6, date: "2-okt" },
];

export const roadmapSteps = [
  { t: "Maqsadni tanlash", d: "Imtihon turi, fan va sana", done: true },
  { t: "Diagnostika", d: "Boshlang'ich bilim darajasi", done: true },
  { t: "Talablar bilan tanishish", d: "Rasmiy spetsifikatsiya va yo'riqnoma", done: false },
  { t: "Hujjatlarni tayyorlash", d: "Cheklist bo'yicha", done: false },
  { t: "Ro'yxatdan o'tish", d: "Rasmiy platformada", done: false },
  { t: "Imtihon simulyatsiyasi", d: "Vaqt bilan to'liq test", done: false },
];
export const officialLinks = [
  { title: "Rasmiy yo'riqnoma (namuna)", source: "Manba kiritilmagan", checked: "—", demo: true },
  { title: "Imtihon spetsifikatsiyasi (namuna)", source: "Manba kiritilmagan", checked: "—", demo: true },
];
export const checklist = [
  { id: "h1", t: "Pasport nusxasi", done: true }, { id: "h2", t: "Diplom nusxasi", done: true },
  { id: "h3", t: "Mehnat daftarchasi ko'chirmasi", done: false }, { id: "h4", t: "Oxirgi malaka oshirish guvohnomasi", done: false },
  { id: "h5", t: "Dars tahlili (portfolio)", done: false },
];
export const events = [
  { d: 14, t: "Diagnostika", c: "ai" }, { d: 16, t: "Mavzuli test", c: "ai" }, { d: 19, t: "Hujjatlar", c: "toifa" },
  { d: 22, t: "Takrorlash kuni", c: "ai" }, { d: 25, t: "Simulyatsiya", c: "ai" }, { d: 28, t: "Sinov imtihoni", c: "toifa" },
];

export const adminUsers = [
  { id: 1, name: "Aliyev Behzod", phone: "+998 90 123 45 67", role: "O'qituvchi", plan: "PRO", date: "24.04.2026", status: "Faol" },
  { id: 2, name: "Karimova Malika", phone: "+998 90 234 56 78", role: "Kurs muallifi", plan: "PREMIUM", date: "23.04.2026", status: "Faol" },
  { id: 3, name: "Jo'rayev Sardor", phone: "+998 90 345 67 89", role: "O'qituvchi", plan: "FREE", date: "22.04.2026", status: "Faol" },
  { id: 4, name: "Ismoilova Sevinch", phone: "+998 90 456 78 90", role: "Metodist", plan: "PRO", date: "21.04.2026", status: "Faol" },
  { id: 5, name: "Normurodov Aziz", phone: "+998 90 567 89 01", role: "O'qituvchi", plan: "FREE", date: "20.04.2026", status: "Bloklangan" },
];
export const adminQuestions = [
  { id: "Q-101", q: "Formativ baholashning maqsadi...", topic: "Formativ baholash", status: "Approved" },
  { id: "Q-102", q: "Dars maqsadi qaysi holatda to'g'ri...", topic: "Pedagogik mahorat", status: "Review" },
  { id: "Q-103", q: "Bo'lish amali ko'paytirishga...", topic: "Matematika metodikasi", status: "Draft" },
  { id: "Q-104", q: "Kasb standarti talabi...", topic: "Kasb standarti", status: "Rejected" },
  { id: "Q-105", q: "Differensial topshiriq maqsadi...", topic: "Inklyuziv ta'lim", status: "Approved" },
];
export const adminPayments = [
  { id: "P-9001", user: "Aliyev Behzod", plan: "PRO", amount: 39000, date: "24.04.2026", status: "To'langan" },
  { id: "P-9002", user: "Ismoilova Sevinch", plan: "PRO", amount: 39000, date: "23.04.2026", status: "To'langan" },
  { id: "P-9003", user: "Karimova Malika", plan: "PREMIUM", amount: 69000, date: "22.04.2026", status: "Kutilmoqda" },
  { id: "P-9004", user: "Jo'rayev Sardor", plan: "PRO", amount: 39000, date: "21.04.2026", status: "Bekor qilingan" },
];
export const fmt = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ") + " so'm";
