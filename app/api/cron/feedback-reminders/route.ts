import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pendingRaters } from "@/lib/feedback/pending";
import { build360Email, create360Transporter, has360Email, FROM_360 } from "@/lib/feedback/email360";

// Daily cron (see vercel.json). For every active period whose deadline is 3 days
// away (or less) and hasn't had its automatic reminder sent, email everyone who
// still hasn't submitted, then mark the reminder as sent so it fires only once.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!has360Email()) return NextResponse.json({ ok: true, skipped: "email not configured" });

  const now = new Date();
  const periods = await prisma.feedbackPeriod.findMany({
    where: { isActive: true, deadline: { not: null }, d3ReminderAt: null },
  });

  let totalSent = 0;
  const summary: { period: string; sent: number }[] = [];
  for (const period of periods) {
    if (!period.deadline) continue;
    const msLeft = new Date(period.deadline).getTime() - now.getTime();
    const daysLeft = msLeft / (24 * 60 * 60 * 1000);
    // fire when 3 days or fewer remain (but the deadline hasn't passed by >1 day)
    if (daysLeft > 3 || daysLeft < -1) continue;

    const pending = await pendingRaters(period.id);
    const transporter = create360Transporter();
    let sent = 0;
    for (const p of pending) {
      if (!p.email) continue;
      const { subject, html } = build360Email({ name: p.name || p.email, kind: "followup", periodName: period.name, deadline: period.deadline, pendingCount: p.pendingCount });
      try {
        await transporter.sendMail({ from: FROM_360, to: p.email, subject, html });
        sent++;
      } catch { /* skip failed address, continue */ }
    }
    await prisma.feedbackPeriod.update({ where: { id: period.id }, data: { d3ReminderAt: now } });
    totalSent += sent;
    summary.push({ period: period.name, sent });
  }

  return NextResponse.json({ ok: true, totalSent, summary });
}
