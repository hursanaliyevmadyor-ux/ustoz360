import { ROLE_LABEL, type Role } from "../lib/roles";
import { ApiError } from "./auth";
import { db } from "./db";

/**
 * Admin statistikasi: yo'nalishlar bo'yicha alohida bo'limlar. Faqat YIG'MA raqamlar: ustozning shaxsiy ma'lumoti
 * (sinf, o'quvchi taxalluslari va ballari, hujjat matni, AI suhbat matni) bu yerda ko'rsatilmaydi.
 * Har bo'lim alohida so'rov bilan yuklanadi (sekin bazada sahifa tez ochilishi uchun).
 */
export type Kpi = { label: string; value: string | number; hint?: string };
export type Series = { title: string; labels: string[]; data: number[] };
export type Table = { title: string; columns: string[]; rows: (string | number)[][] };
export type Section = { key: string; title: string; description: string; kpis: Kpi[]; series: Series[]; tables: Table[]; note?: string };

export const SECTION_KEYS = ["users", "admins", "ustoz-ai", "darsyor", "toifa", "sinf", "market", "bilimxona", "ai", "seminarlar"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_TITLES: Record<SectionKey, string> = {
  users: "Ustozlar va foydalanuvchilar", admins: "Adminlar", "ustoz-ai": "USTOZ AI", darsyor: "DARSYOR", toifa: "TOIFA NAVIGATOR", sinf: "SINF ANALITIKA",
  market: "USTOZ MARKET", bilimxona: "BILIMXONA", ai: "AI va BEPUL AI", seminarlar: "Seminarlar",
};

const dayStart = (n: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d; };
const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const num = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const fmt = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");

/** Kunlar bo'yicha qatorlar soni. `table` va `col` faqat kodda berilgan o'zgarmaslar (foydalanuvchi kiritmaydi). */
async function daily(table: string, col: string, days: number, where = "", agg = "count(*)"): Promise<Series["data"]> {
  const since = dayStart(days - 1);
  const rows = await db.$queryRawUnsafe<{ d: Date; n: unknown }[]>(`select date_trunc('day', "${col}") as d, ${agg}::float as n from "${table}" where "${col}" >= $1 ${where ? `and ${where}` : ""} group by 1`, since);
  const map = new Map(rows.map((r) => [new Date(r.d).toISOString().slice(0, 10), num(r.n)]));
  return Array.from({ length: days }, (_, i) => map.get(dayStart(days - 1 - i).toISOString().slice(0, 10)) ?? 0);
}
const labels = (days: number) => Array.from({ length: days }, (_, i) => dm(dayStart(days - 1 - i)));
const base = (key: SectionKey, description: string): Section => ({ key, title: SECTION_TITLES[key], description, kpis: [], series: [], tables: [] });
const roleName = (r: string) => ROLE_LABEL[r as Role] ?? r;

export async function buildSection(key: string, days: number): Promise<Section> {
  if (!(SECTION_KEYS as readonly string[]).includes(key)) throw new ApiError(400, "Bo'lim noto'g'ri.");
  const d = [7, 30, 90].includes(days) ? days : 30;
  const since = dayStart(d - 1);
  const L = labels(d);
  switch (key as SectionKey) {
    case "users": {
      const s = base("users", `Oxirgi ${d} kun. Ustozlar va umumiy foydalanuvchilar.`);
      const noAdmin = { NOT: { roles: { some: { role: { in: ["ADMIN" as Role, "SUPERADMIN" as Role] } } } } };
      const [total, teachers, fresh, blocked, onboarded, roles, active, regions, signups] = await Promise.all([
        db.user.count({ where: { deletedAt: null } }),
        db.user.count({ where: { deletedAt: null, ...noAdmin } }),
        db.user.count({ where: { deletedAt: null, createdAt: { gte: since }, ...noAdmin } }),
        db.user.count({ where: { deletedAt: { not: null } } }),
        db.profile.count({ where: { onboardedAt: { not: null }, user: { deletedAt: null, ...noAdmin } } }),
        db.userRole.groupBy({ by: ["role"], _count: true }),
        db.$queryRawUnsafe<{ n: unknown }[]>(`select count(distinct u) as n from (select "userId" as u from "TestSession" where "startedAt" >= $1 union select "userId" from "AiRequest" where "createdAt" >= $1 union select "userId" from "TeacherDoc" where "updatedAt" >= $1 union select "userId" from "PlanItem" where "createdAt" >= $1 union select "userId" from "ExamAttempt" where "startedAt" >= $1) t`, since),
        db.profile.groupBy({ by: ["region"], where: { region: { not: null }, user: { deletedAt: null, ...noAdmin } }, _count: true, orderBy: { _count: { region: "desc" } }, take: 10 }),
        daily("User", "createdAt", d),
      ]);
      s.kpis = [
        { label: "Ustozlar", value: fmt(teachers), hint: "admin bo'lmagan faol foydalanuvchilar" },
        { label: `Yangi (${d} kun)`, value: fmt(fresh) },
        { label: "Faol (shu davrda)", value: fmt(num(active[0]?.n)), hint: "test, AI, reja, hujjat yoki imtihon bilan" },
        { label: "Profili to'ldirilgan", value: pct(onboarded, teachers), hint: `${fmt(onboarded)} ta` },
        { label: "Jami hisoblar", value: fmt(total) },
        { label: "Bloklanganlar", value: fmt(blocked) },
      ];
      s.series = [{ title: "Yangi ro'yxatdan o'tganlar", labels: L, data: signups }];
      s.tables = [
        { title: "Rollar", columns: ["Rol", "Soni"], rows: roles.map((r) => [roleName(r.role), r._count]) },
        { title: "Viloyatlar (ustozlar)", columns: ["Viloyat", "Soni"], rows: regions.map((r) => [r.region ?? "—", r._count]) },
      ];
      return s;
    }
    case "admins": {
      const s = base("admins", `Adminlar va ularning amallari, oxirgi ${d} kun.`);
      const [admins, actions, byAction, perDay] = await Promise.all([
        db.user.findMany({ where: { roles: { some: { role: { in: ["ADMIN", "SUPERADMIN"] } } } }, select: { id: true, name: true, email: true, deletedAt: true, roles: { select: { role: true } } } }),
        db.auditLog.groupBy({ by: ["userId"], where: { action: { startsWith: "admin." }, createdAt: { gte: since } }, _count: true }),
        db.auditLog.groupBy({ by: ["action"], where: { action: { startsWith: "admin." }, createdAt: { gte: since } }, _count: true, orderBy: { _count: { action: "desc" } }, take: 12 }),
        daily("AuditLog", "createdAt", d, `"action" like 'admin.%'`),
      ]);
      const cnt = new Map(actions.map((a) => [a.userId, a._count]));
      const total = actions.reduce((a, x) => a + x._count, 0);
      s.kpis = [{ label: "Adminlar", value: admins.length }, { label: `Amallar (${d} kun)`, value: fmt(total) }, { label: "Faol adminlar", value: admins.filter((a) => cnt.has(a.id)).length, hint: "shu davrda amal qilganlar" }];
      s.series = [{ title: "Admin amallari", labels: L, data: perDay }];
      s.tables = [
        { title: "Adminlar", columns: ["Ism", "Email", "Rol", "Amallar", "Holat"], rows: admins.map((a) => [a.name ?? "—", a.email ?? "—", a.roles.some((r) => r.role === "SUPERADMIN") ? "Bosh administrator" : "Administrator", cnt.get(a.id) ?? 0, a.deletedAt ? "Bloklangan" : "Faol"]) },
        { title: "Amal turlari", columns: ["Amal", "Soni"], rows: byAction.map((a) => [a.action.replace("admin.", ""), a._count]) },
      ];
      return s;
    }
    case "ustoz-ai": {
      const s = base("ustoz-ai", `Testlar, diagnostika, mashq va savollar bazasi, oxirgi ${d} kun.`);
      const [byMode, submitted, avg, users, qStatus, qDiff, errors, reports, exams, perDay, weak] = await Promise.all([
        db.testSession.groupBy({ by: ["mode"], where: { startedAt: { gte: since } }, _count: true }),
        db.testSession.count({ where: { startedAt: { gte: since }, status: "SUBMITTED" } }),
        db.$queryRawUnsafe<{ a: unknown }[]>(`select avg(score::float / nullif(total, 0)) * 100 as a from "TestSession" where "startedAt" >= $1 and status = 'SUBMITTED' and total > 0`, since),
        db.$queryRawUnsafe<{ n: unknown }[]>(`select count(distinct "userId") as n from "TestSession" where "startedAt" >= $1`, since),
        db.question.groupBy({ by: ["status"], where: { collectionId: null }, _count: true }),
        db.question.groupBy({ by: ["difficulty"], where: { status: "APPROVED" }, _count: true }),
        db.errorCard.groupBy({ by: ["mastered"], _count: true }),
        db.questionReport.count(),
        db.examAttempt.aggregate({ where: { startedAt: { gte: since } }, _count: true }),
        daily("TestSession", "startedAt", d),
        db.$queryRawUnsafe<{ name: string; n: unknown; p: unknown }[]>(`select t.name as name, count(*)::int as n, avg(case when a."isCorrect" then 1.0 else 0 end) * 100 as p from "UserAnswer" a join "Question" q on q.id = a."questionId" join "Topic" t on t.id = q."topicId" where a."answeredAt" >= $1 group by t.name having count(*) >= 5 order by p asc limit 8`, since),
      ]);
      const total = byMode.reduce((a, x) => a + x._count, 0);
      const open = errors.find((e) => !e.mastered)?._count ?? 0, mastered = errors.find((e) => e.mastered)?._count ?? 0;
      s.kpis = [
        { label: "Boshlangan testlar", value: fmt(total) }, { label: "Yakunlangan", value: pct(submitted, total), hint: `${fmt(submitted)} ta` },
        { label: "O'rtacha natija", value: avg[0]?.a == null ? "—" : `${Math.round(num(avg[0].a))}%` }, { label: "Faol ustozlar", value: fmt(num(users[0]?.n)) },
        { label: "Imtihon urinishlari", value: fmt(exams._count) }, { label: "Tasdiqlangan savollar", value: fmt(qStatus.find((x) => x.status === "APPROVED")?._count ?? 0) },
        { label: "Ochiq xatolar", value: fmt(open), hint: `${fmt(mastered)} ta o'zlashtirilgan` }, { label: "Savol xabarlari", value: fmt(reports), hint: "«Savolda xato bor»" },
      ];
      s.series = [{ title: "Boshlangan testlar", labels: L, data: perDay }];
      s.tables = [
        { title: "Rejimlar bo'yicha", columns: ["Rejim", "Soni"], rows: byMode.map((m) => [m.mode, m._count]) },
        { title: "Savollar holati", columns: ["Holat", "Soni"], rows: qStatus.map((q) => [q.status, q._count]) },
        { title: "Qiyinlik (tasdiqlangan)", columns: ["Daraja", "Soni"], rows: qDiff.map((q) => [q.difficulty, q._count]) },
        { title: "Eng qiyin mavzular (kamida 5 javob)", columns: ["Mavzu", "Javoblar", "To'g'ri"], rows: weak.map((w) => [w.name, num(w.n), `${Math.round(num(w.p))}%`]) },
      ];
      return s;
    }
    case "darsyor": {
      const s = base("darsyor", `O'qituvchi hujjatlari (matni ko'rsatilmaydi), oxirgi ${d} kun.`);
      const [byKind, users, drafts, saved, ai, perDay] = await Promise.all([
        db.teacherDoc.groupBy({ by: ["kind"], where: { updatedAt: { gte: since } }, _count: true }),
        db.$queryRawUnsafe<{ n: unknown }[]>(`select count(distinct "userId") as n from "TeacherDoc"`),
        db.teacherDoc.count({ where: { status: "DRAFT" } }), db.teacherDoc.count({ where: { status: "SAVED" } }),
        db.aiRequest.groupBy({ by: ["status"], where: { createdAt: { gte: since }, promptVersion: { startsWith: "lesson" } }, _count: true }),
        daily("TeacherDoc", "createdAt", d),
      ]);
      const aiTotal = ai.reduce((a, x) => a + x._count, 0);
      s.kpis = [
        { label: "Hujjatlar (jami)", value: fmt(drafts + saved), hint: `${fmt(saved)} saqlangan, ${fmt(drafts)} qoralama` },
        { label: "Ustozlar (hujjati bor)", value: fmt(num(users[0]?.n)) },
        { label: `Yangilangan (${d} kun)`, value: fmt(byKind.reduce((a, x) => a + x._count, 0)) },
        { label: "Dars ishlanmasi AI so'rovlari", value: fmt(aiTotal) },
      ];
      s.series = [{ title: "Yangi hujjatlar", labels: L, data: perDay }];
      s.tables = [{ title: "Turlar bo'yicha", columns: ["Tur", "Soni"], rows: byKind.map((k) => [({ lesson_plan: "Dars ishlanmasi", visual: "Ko'rgazma", rubric: "Rubrika", observation: "Kuzatuv varaqasi", taskset: "Topshiriqlar" } as Record<string, string>)[k.kind] ?? k.kind, k._count]) }];
      return s;
    }
    case "toifa": {
      const s = base("toifa", `Tayyorgarlik rejalari va rasmiy ma'lumotlar, oxirgi ${d} kun.`);
      const [goals, plans, items, done, checklist, official, doneDaily] = await Promise.all([
        db.profile.groupBy({ by: ["targetExam"], where: { targetExam: { not: null } }, _count: true }),
        db.$queryRawUnsafe<{ n: unknown }[]>(`select count(distinct "userId") as n from "PlanItem"`),
        db.planItem.groupBy({ by: ["source"], _count: true }),
        db.planItem.count({ where: { doneAt: { not: null } } }),
        db.checklistItem.groupBy({ by: ["doneAt"], _count: true }).then((r) => ({ total: r.reduce((a, x) => a + x._count, 0), done: r.filter((x) => x.doneAt).reduce((a, x) => a + x._count, 0) })),
        db.officialInfo.groupBy({ by: ["verified"], where: { active: true }, _count: true }),
        daily("PlanItem", "doneAt", d),
      ]);
      const totalItems = items.reduce((a, x) => a + x._count, 0);
      s.kpis = [
        { label: "Maqsad belgilaganlar", value: fmt(goals.reduce((a, x) => a + x._count, 0)) }, { label: "Rejasi borlar", value: fmt(num(plans[0]?.n)) },
        { label: "Reja bandlari", value: fmt(totalItems), hint: `${fmt(items.find((i) => i.source === "AUTO")?._count ?? 0)} ta avtomatik` }, { label: "Bajarilgan", value: pct(done, totalItems), hint: `${fmt(done)} ta` },
        { label: "Cheklist bandlari", value: fmt(checklist.total), hint: `${fmt(checklist.done)} ta tayyor` },
        { label: "Rasmiy ma'lumot", value: fmt(official.reduce((a, x) => a + x._count, 0)), hint: `${fmt(official.find((o) => o.verified)?._count ?? 0)} ta tekshirilgan` },
      ];
      s.series = [{ title: "Bajarilgan vazifalar", labels: L, data: doneDaily }];
      s.tables = [{ title: "Imtihon maqsadi", columns: ["Imtihon", "Ustozlar"], rows: goals.map((g) => [g.targetExam === "ATTESTATSIYA" ? "Attestatsiya" : g.targetExam === "MILLIY_SERTIFIKAT" ? "Milliy sertifikat" : String(g.targetExam), g._count]) }];
      return s;
    }
    case "sinf": {
      const s = base("sinf", `Faqat yig'ma raqamlar. Sinf nomi, o'quvchi taxalluslari va ballari admin uchun ochiq emas. Oxirgi ${d} kun.`);
      const [classes, teachers, students, assessments, scores, avg, byKind, perDay] = await Promise.all([
        db.classroom.count(), db.$queryRawUnsafe<{ n: unknown }[]>(`select count(distinct "userId") as n from "Classroom"`), db.student.count(),
        db.assessment.count({ where: { createdAt: { gte: since } } }), db.assessmentScore.count(),
        db.$queryRawUnsafe<{ a: unknown }[]>(`select avg(s.score / nullif(a."maxScore", 0)) * 100 as a from "AssessmentScore" s join "Assessment" a on a.id = s."assessmentId"`),
        db.assessment.groupBy({ by: ["kind"], where: { createdAt: { gte: since } }, _count: true }),
        daily("Assessment", "createdAt", d),
      ]);
      s.kpis = [
        { label: "Sinflar", value: fmt(classes) }, { label: "Sinf ochgan ustozlar", value: fmt(num(teachers[0]?.n)) }, { label: "O'quvchi (taxallus)", value: fmt(students) },
        { label: `Baholashlar (${d} kun)`, value: fmt(assessments) }, { label: "Kiritilgan natijalar", value: fmt(scores) }, { label: "O'rtacha natija (hammasi)", value: avg[0]?.a == null ? "—" : `${Math.round(num(avg[0].a))}%` },
      ];
      s.series = [{ title: "Yangi baholashlar", labels: L, data: perDay }];
      s.tables = [{ title: "Baholash turlari", columns: ["Tur", "Soni"], rows: byKind.map((k) => [({ BEFORE: "Oldin", AFTER: "Keyin", CURRENT: "Joriy" } as Record<string, string>)[k.kind] ?? k.kind, k._count]) }];
      s.note = "Maxfiylik: ustozlarning shaxsiy sinf ma'lumotlari admin sahifasida ko'rsatilmaydi.";
      return s;
    }
    case "market": {
      const s = base("market", `Kurslar, to'lovlar va obunalar, oxirgi ${d} kun.`);
      const [courses, pay, paidDaily, subs, authors, top, access] = await Promise.all([
        db.course.groupBy({ by: ["status"], _count: true }),
        db.payment.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true, _sum: { amount: true } }),
        daily("Payment", "paidAt", d, `status = 'PAID'`, `coalesce(sum("amount"), 0)`),
        db.subscription.groupBy({ by: ["planKey"], where: { status: "ACTIVE", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, _count: true }),
        db.userRole.count({ where: { role: "COURSE_AUTHOR" } }),
        db.course.findMany({ where: { status: "APPROVED" }, orderBy: { access: { _count: "desc" } }, take: 8, select: { title: true, priceUzs: true, _count: { select: { access: true } } } }),
        db.courseAccess.count({ where: { grantedAt: { gte: since } } }),
      ]);
      const paid = pay.find((p) => p.status === "PAID");
      s.kpis = [
        { label: "Kurslar (tasdiqlangan)", value: fmt(courses.find((c) => c.status === "APPROVED")?._count ?? 0), hint: `${fmt(courses.find((c) => c.status === "REVIEW")?._count ?? 0)} ta tekshiruvda` },
        { label: "Mualliflar", value: fmt(authors) }, { label: `To'langan (${d} kun)`, value: `${fmt(paid?._sum.amount ?? 0)} so'm`, hint: `${fmt(paid?._count ?? 0)} ta to'lov` },
        { label: "Kutilayotgan to'lov", value: fmt(pay.find((p) => p.status === "PENDING")?._count ?? 0) }, { label: `Yangi kirishlar (${d} kun)`, value: fmt(access) },
        { label: "Faol obunalar", value: fmt(subs.reduce((a, x) => a + x._count, 0)) },
      ];
      s.series = [{ title: "Kunlik tushum (so'm)", labels: L, data: paidDaily }];
      s.tables = [
        { title: "Kurslar holati", columns: ["Holat", "Soni"], rows: courses.map((c) => [c.status, c._count]) },
        { title: "To'lovlar holati", columns: ["Holat", "Soni", "Summa"], rows: pay.map((p) => [p.status, p._count, `${fmt(p._sum.amount ?? 0)} so'm`]) },
        { title: "Obunalar", columns: ["Tarif", "Faol"], rows: subs.map((x) => [x.planKey, x._count]) },
        { title: "Eng ko'p sotilgan kurslar", columns: ["Kurs", "Narx", "Sotuv"], rows: top.map((c) => [c.title, c.priceUzs ? `${fmt(c.priceUzs)} so'm` : "Bepul", c._count.access]) },
      ];
      return s;
    }
    case "bilimxona": {
      const s = base("bilimxona", `Kutubxona hujjatlari (matni ko'rsatilmaydi), oxirgi ${d} kun.`);
      const [vis, status, size, mime, fav, chunks, subjects, perDay] = await Promise.all([
        db.libraryDoc.groupBy({ by: ["visibility"], _count: true }), db.libraryDoc.groupBy({ by: ["status"], _count: true }),
        db.libraryDoc.aggregate({ _sum: { sizeBytes: true }, _count: true }), db.libraryDoc.groupBy({ by: ["mime"], _count: true }),
        db.libraryFavorite.count(), db.libraryChunk.count(),
        db.libraryDoc.groupBy({ by: ["subject"], where: { subject: { not: null } }, _count: true, orderBy: { _count: { subject: "desc" } }, take: 8 }),
        daily("LibraryDoc", "createdAt", d),
      ]);
      const mb = (size._sum.sizeBytes ?? 0) / 1024 / 1024;
      s.kpis = [
        { label: "Hujjatlar", value: fmt(size._count) }, { label: "Umumiy hajm", value: `${mb.toFixed(1)} MB` },
        { label: "Tekshiruvda", value: fmt(vis.find((v) => v.visibility === "PUBLIC_PENDING")?._count ?? 0), hint: "ommaviy qilish so'rovi" },
        { label: "Ommaviy", value: fmt(vis.find((v) => v.visibility === "PUBLIC")?._count ?? 0) }, { label: "Sevimlilar", value: fmt(fav) }, { label: "Indekslangan bo'laklar", value: fmt(chunks) },
      ];
      s.series = [{ title: "Yuklangan hujjatlar", labels: L, data: perDay }];
      s.tables = [
        { title: "Ko'rinish", columns: ["Holat", "Soni"], rows: vis.map((v) => [v.visibility, v._count]) },
        { title: "Indekslash", columns: ["Holat", "Soni"], rows: status.map((x) => [x.status, x._count]) },
        { title: "Fayl turi", columns: ["Tur", "Soni"], rows: mime.map((m) => [m.mime.includes("pdf") ? "PDF" : m.mime.includes("word") ? "DOCX" : "TXT", m._count]) },
        { title: "Fanlar", columns: ["Fan", "Soni"], rows: subjects.map((x) => [x.subject ?? "—", x._count]) },
      ];
      return s;
    }
    case "ai": {
      const s = base("ai", `AI so'rovlari (matn saqlanmaydi), oxirgi ${d} kun.`);
      const [byFeature, tot, users, chats, msgs, perDay, byPrompt] = await Promise.all([
        db.aiRequest.groupBy({ by: ["feature", "status"], where: { createdAt: { gte: since } }, _count: true }),
        db.aiRequest.aggregate({ where: { createdAt: { gte: since } }, _count: true, _avg: { latencyMs: true }, _sum: { inputTokens: true, outputTokens: true, costMicro: true } }),
        db.$queryRawUnsafe<{ n: unknown }[]>(`select count(distinct "userId") as n from "AiRequest" where "createdAt" >= $1`, since),
        db.aiChat.count({ where: { createdAt: { gte: since } } }), db.aiMessage.count({ where: { createdAt: { gte: since } } }),
        daily("AiRequest", "createdAt", d),
        db.aiRequest.groupBy({ by: ["promptVersion"], where: { createdAt: { gte: since }, promptVersion: { not: null } }, _count: true, orderBy: { _count: { promptVersion: "desc" } }, take: 8 }),
      ]);
      const feat = new Map<string, { calls: number; ok: number; err: number; blocked: number }>();
      for (const r of byFeature) { const e = feat.get(r.feature) ?? { calls: 0, ok: 0, err: 0, blocked: 0 }; e.calls += r._count; if (r.status === "ok" || r.status === "truncated") e.ok += r._count; else if (r.status === "blocked") e.blocked += r._count; else e.err += r._count; feat.set(r.feature, e); }
      const errTotal = Array.from(feat.values()).reduce((a, x) => a + x.err, 0);
      s.kpis = [
        { label: "So'rovlar", value: fmt(tot._count) }, { label: "AI ishlatgan ustozlar", value: fmt(num(users[0]?.n)) }, { label: "Xatolar", value: pct(errTotal, tot._count), hint: `${fmt(errTotal)} ta` },
        { label: "O'rtacha kechikish", value: tot._avg.latencyMs ? `${Math.round(tot._avg.latencyMs)} ms` : "—" }, { label: "Tokenlar", value: fmt((tot._sum.inputTokens ?? 0) + (tot._sum.outputTokens ?? 0)) },
        { label: "Taxminiy narx", value: tot._sum.costMicro ? `$${((tot._sum.costMicro ?? 0) / 1_000_000).toFixed(2)}` : "narx kiritilmagan" }, { label: "AI suhbatlari", value: fmt(chats), hint: `${fmt(msgs)} ta xabar` },
      ];
      s.series = [{ title: "AI so'rovlari", labels: L, data: perDay }];
      s.tables = [
        { title: "Funksiyalar bo'yicha", columns: ["Funksiya", "So'rov", "Muvaffaqiyatli", "Xato", "Bloklangan"], rows: Array.from(feat.entries()).sort((a, b) => b[1].calls - a[1].calls).map(([f, v]) => [f, v.calls, v.ok, v.err, v.blocked]) },
        { title: "Prompt versiyalari", columns: ["Versiya", "So'rov"], rows: byPrompt.map((p) => [p.promptVersion ?? "—", p._count]) },
      ];
      return s;
    }
    case "seminarlar": {
      const s = base("seminarlar", "Seminarlar va imtihonlar.");
      const now = new Date();
      const [total, upcoming, active, past, exams, list] = await Promise.all([
        db.seminar.count(), db.seminar.count({ where: { startsAt: { gte: now }, active: true } }), db.seminar.count({ where: { active: true } }), db.seminar.count({ where: { startsAt: { lt: now } } }),
        db.exam.groupBy({ by: ["active"], _count: true }),
        db.seminar.findMany({ where: { startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 8, select: { title: true, startsAt: true, place: true, capacity: true, active: true } }),
      ]);
      s.kpis = [{ label: "Seminarlar (jami)", value: fmt(total) }, { label: "Yaqinlashayotgan", value: fmt(upcoming) }, { label: "O'tib ketgan", value: fmt(past) }, { label: "Faol e'lonlar", value: fmt(active) },
        { label: "Faol imtihonlar", value: fmt(exams.find((e) => e.active)?._count ?? 0) }, { label: "Yashirin imtihonlar", value: fmt(exams.find((e) => !e.active)?._count ?? 0) }];
      s.tables = [{ title: "Yaqin seminarlar", columns: ["Nomi", "Sana", "Joy", "O'rinlar", "Ko'rinadi"], rows: list.map((x) => [x.title, x.startsAt.toISOString().slice(0, 16).replace("T", " "), x.place ?? "—", x.capacity ?? "—", x.active ? "ha" : "yo'q"]) }];
      return s;
    }
  }
}
