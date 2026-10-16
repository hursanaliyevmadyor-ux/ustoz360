import { redirect } from "next/navigation";

/** Shaxsiy reja imtihon va attestatsiya tayyorgarligiga tegishli, shuning uchun TOIFA NAVIGATOR → Reja bo'limida. */
export default function Page() { redirect("/toifa/reja?view=kunlik"); }
