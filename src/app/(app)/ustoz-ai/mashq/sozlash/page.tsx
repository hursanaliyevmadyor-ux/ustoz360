"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/states";
import { TestSetup } from "@/components/tests/test-setup";

function Inner() {
  const kind = useSearchParams().get("kind");
  return <TestSetup mode={kind === "ai" ? "ai" : "practice"} />;
}

export default function Page() {
  return <React.Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}><Inner /></React.Suspense>;
}
