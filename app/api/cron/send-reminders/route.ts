import { NextRequest, NextResponse } from "next/server";
import { processDueSchedules } from "@/lib/process-schedules";

// Optional fallback endpoint — can be called manually or via external cron if needed
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await processDueSchedules();
  return NextResponse.json({ ok: true });
}
