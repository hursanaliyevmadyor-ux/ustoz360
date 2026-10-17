export type LibDoc = {
  id: string; title: string; fileName: string; type: "PDF" | "DOCX" | "TXT"; sizeBytes: number;
  visibility: "PRIVATE" | "PUBLIC_PENDING" | "PUBLIC"; status: "UPLOADED" | "READY" | "FAILED";
  subject: string | null; tags: string[]; textChars: number | null; createdAt: string; mine: boolean; owner: string | null; favorite: boolean;
};
export type LibList = { total: number; page: number; pages: number; docs: LibDoc[]; subjects: string[]; storage: { configured: boolean; note: string | null } };

export const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const VIS: Record<LibDoc["visibility"], string> = { PRIVATE: "Shaxsiy", PUBLIC_PENDING: "Tekshiruvda", PUBLIC: "Ommaviy" };
