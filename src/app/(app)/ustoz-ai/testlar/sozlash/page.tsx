"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/states";
import { TestSetup } from "@/components/tests/test-setup";
import type { SetupMode } from "@/components/tests/modes";

const VALID: SetupMode[] = ["timed", "topic", "mixed", "situational", "errors"];

function Inner() {
  const m = useSearchParams().get("mode") as SetupMode | null;
  return <TestSetup mode={m && VALID.includes(m) ? m : "timed"} />;
}

export default function Page() {
  return <React.Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}><Inner /></React.Suspense>;
}
