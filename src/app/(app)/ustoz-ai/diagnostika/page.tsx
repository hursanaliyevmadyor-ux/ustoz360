"use client";
import * as React from "react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { ServerQuiz } from "./server-quiz";
import { LocalDiagnostics } from "./local-quiz";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

type Mode = "checking" | "server" | "offline" | "local";

export default function Page() {
  const [mode, setMode] = React.useState<Mode>("checking");
  React.useEffect(() => {
    fetch("/api/me").then((r) => setMode(r.ok ? "server" : "offline")).catch(() => setMode("offline"));
  }, []);
  if (mode === "local") return <LocalDiagnostics />;
  if (mode === "offline") return (
    <>
      <PageHeader module={modules[0]} title="Diagnostika" />
      <ErrorState title="Backend ulanmagan" text="Server yoki ma'lumotlar bazasi mavjud emas, shuning uchun natijalar saqlanmaydi. Xohlasangiz namunaviy offline rejimda sinab ko'ring: u faqat brauzerda ishlaydi."
        onRetry={() => { setMode("checking"); fetch("/api/me").then((r) => setMode(r.ok ? "server" : "offline")).catch(() => setMode("offline")); }} />
      <div className="mt-4 flex justify-center"><Button variant="outline" onClick={() => setMode("local")}>Offline demo rejim</Button></div>
    </>
  );
  if (mode === "checking") return <PageHeader module={modules[0]} title="Diagnostika" description="Yuklanmoqda..." />;
  return <ServerQuiz />;
}
