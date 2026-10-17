/** Rollar (server ham, brauzer ham ishlatadi). Haqiqiy tekshiruv doim serverda (requireAdmin va h.k.). */
export const ROLE_KEYS = ["TEACHER", "COURSE_AUTHOR", "ORG_MANAGER", "METHODIST", "ADMIN", "SUPERADMIN"] as const;
export type Role = (typeof ROLE_KEYS)[number];
export const ROLE_LABEL: Record<Role, string> = { TEACHER: "O'qituvchi", COURSE_AUTHOR: "Kurs muallifi", ORG_MANAGER: "Markaz rahbari", METHODIST: "Metodist", ADMIN: "Administrator", SUPERADMIN: "Bosh administrator" };
