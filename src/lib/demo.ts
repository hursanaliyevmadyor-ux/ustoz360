/** NAMUNA ma'lumotlar: faqat foydalanuvchi o'zi so'ragan "Namunani ko'rish" rejimida ko'rsatiladi (LiveGate, "NAMUNA" belgisi bilan). Haqiqiy foydalanuvchi, test yoki rasmiy ma'lumot emas. */
export const user = { name: "Dilnoza Karimova", short: "DK", role: "Boshlang'ich sinf o'qituvchisi", plan: "PRO" as const };

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

