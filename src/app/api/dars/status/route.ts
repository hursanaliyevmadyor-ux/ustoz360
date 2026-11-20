import { NextResponse } from "next/server";
import { isVoiceConfigured } from "@/server/voice";
export const dynamic = "force-dynamic";

/** Ovozli xona yoqilganmi (kalitlar qo'yilganmi)? Qiymatlar hech qachon qaytarilmaydi. */
export const GET = () => NextResponse.json({ voice: isVoiceConfigured() });
