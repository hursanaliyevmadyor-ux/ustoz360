import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./auth";

export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message, ...(e.code && { code: e.code }) }, { status: e.status });
    if (e instanceof ZodError) return NextResponse.json({ error: "So'rov ma'lumotlari noto'g'ri." }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Ichki xatolik." }, { status: 500 });
  }
}
