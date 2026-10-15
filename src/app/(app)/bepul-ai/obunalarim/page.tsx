"use client";
import * as React from "react";
import { ExternalLink, Info } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const providers = [
  { name: "Claude", url: "https://claude.ai", by: "Anthropic", note: "claude.ai akkauntingiz (Gmail bilan kirish mumkin)" },
  { name: "ChatGPT", url: "https://chatgpt.com", by: "OpenAI", note: "chatgpt.com akkauntingiz (Gmail bilan kirish mumkin)" },
  { name: "Gemini", url: "https://gemini.google.com", by: "Google", note: "Gmail akkauntingiz bilan to'g'ridan-to'g'ri" },
];

/** Provayderni brauzerning alohida kichik oynasida, saytning yoniga joylab ochadi. */
function openBeside(url: string) {
  const w = Math.min(520, Math.floor(window.screen.availWidth * 0.45));
  const h = window.screen.availHeight;
  const left = Math.max(0, window.screenX + window.outerWidth - w);
  const win = window.open(url, "_blank", `popup=yes,width=${w},height=${h},left=${left},top=0`);
  if (!win) window.open(url, "_blank", "noopener,noreferrer");
}

export default function Page() {
  const m = modules[6];
  return (
    <>
      <PageHeader module={m} title="Mening AI obunalarim" description="O'zingiz obuna bo'lgan AI xizmatlarini bir joydan oching" />
      <div className="grid gap-4 sm:grid-cols-3">
        {providers.map((p) => (
          <Card key={p.name}><CardContent className="space-y-3">
            <div><p className="text-lg font-bold">{p.name}</p><p className="text-xs text-muted-foreground">{p.by}</p></div>
            <p className="text-sm text-muted-foreground">{p.note}</p>
            <Button className="w-full" onClick={() => openBeside(p.url)}><ExternalLink className="h-4 w-4" />Ochish</Button>
          </CardContent></Card>
        ))}
      </div>
      <Card className="mt-6 max-w-3xl"><CardContent className="flex gap-3 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-2">
          <p className="font-semibold">Nega saytning ichida emas, alohida oynada?</p>
          <p className="text-muted-foreground">Claude, ChatGPT va Gemini xavfsizlik uchun boshqa saytlar ichida ochilishini taqiqlaydi, ularni ichiga joylab bo'lmaydi. Kirishni ham ular o'z sahifasida o'zingiz bajarasiz: Gmail parolingiz va kodlaringiz bizga hech qachon ko'rinmaydi va saqlanmaydi. Tugma oynani saytning yoniga joylab ochadi.</p>
        </div>
      </CardContent></Card>
    </>
  );
}
