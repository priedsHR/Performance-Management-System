import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { build360Email, create360Transporter, has360Email, FROM_360 } from "@/lib/feedback/email360";

// Admin: start (announce) a 360 cycle. Activates the period, sets the deadline
// to 7 days from now, and emails every active employee that the cycle is open.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { periodId, test }: { periodId: string; test?: boolean } = await req.json();
  if (!periodId) return NextResponse.json({ error: "periodId is required." }, { status: 400 });

  const period = await prisma.feedbackPeriod.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Period not found." }, { status: 404 });
  if (!has360Email())
    return NextResponse.json({ error: "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD in the deployment settings." }, { status: 400 });

  const now = new Date();
  const deadline = period.deadline && !test ? period.deadline : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Test mode: only email the admin, don't change the period.
  if (test) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
    if (!me?.email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
    const { subject, html } = build360Email({ name: me.name ?? me.email, kind: "start", periodName: period.name, deadline, pendingCount: 0 });
    try {
      await create360Transporter().sendMail({ from: FROM_360, to: me.email, subject: `[TEST] ${subject}`, html });
      return NextResponse.json({ success: true, message: `Test start-cycle email sent to ${me.email}.` });
    } catch (e) {
      return NextResponse.json({ success: false, message: e instanceof Error ? e.message : "Failed to send test email." }, { status: 200 });
    }
  }

  // Activate period + set the dates (only one active period at a time).
  await prisma.feedbackPeriod.updateMany({ where: { isActive: true }, data: { isActive: false } });
  await prisma.feedbackPeriod.update({
    where: { id: periodId },
    data: { isActive: true, startedAt: now, deadline, d3ReminderAt: null },
  });

  const recipients = await prisma.user.findMany({
    where: { feedbackProfile: { active: true } },
    select: { name: true, email: true },
    orderBy: { name: "asc" },
  });

  const transporter = create360Transporter();
  const results: { name: string; email: string; status: "sent" | "error"; error?: string }[] = [];
  for (const u of recipients) {
    if (!u.email) continue;
    const { subject, html } = build360Email({ name: u.name ?? u.email, kind: "start", periodName: period.name, deadline, pendingCount: 0 });
    try {
      await transporter.sendMail({ from: FROM_360, to: u.email, subject, html });
      results.push({ name: u.name ?? "-", email: u.email, status: "sent" });
    } catch (e) {
      results.push({ name: u.name ?? "-", email: u.email, status: "error", error: e instanceof Error ? e.message : "error" });
    }
  }
  const sent = results.filter((r) => r.status === "sent").length;
  return NextResponse.json({
    success: sent > 0,
    message: `Cycle started. ${sent}/${recipients.length} employees notified. Deadline: ${deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
    results,
  });
}
