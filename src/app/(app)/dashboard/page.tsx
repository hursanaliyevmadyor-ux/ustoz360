"use client";
import { LiveGate } from "@/components/layout/live-gate";
import { DemoDashboard } from "./demo";
import { LiveDashboard, type DashboardData } from "./live";

export default function Page() {
  return <LiveGate<DashboardData> url="/api/dashboard" render={(d) => <LiveDashboard d={d} />} demo={<DemoDashboard />} />;
}
