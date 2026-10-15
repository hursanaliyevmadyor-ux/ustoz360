"use client";
import { ServerQuiz } from "../../diagnostika/server-quiz";

export default function Page() {
  return (
    <ServerQuiz startUrl="/api/review/start" submitUrl="/api/review/submit" title="Xatolarni takrorlash" startLabel="Takrorlashni boshlash"
      intro="Muddati kelgan xatolaringizdan savollar beriladi. To'g'ri javob keyingi takrorlashni uzoqroqqa suradi, noto'g'ri javob ertangi kunga qaytaradi." />
  );
}
