import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { computeAssignmentsFor, loadPeerExclusions, loadProfilesLite } from "@/lib/feedback/service";

const APP_URL = process.env.NEXTAUTH_URL ?? "";
const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? "";

function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

function buildEmail360Html({
  name,
  type,
  periodName,
  pendingCount,
}: {
  name: string;
  type: "initial" | "followup";
  periodName: string;
  pendingCount: number;
}) {
  const isFollowUp = type === "followup";
  const subject = isFollowUp
    ? `[Follow Up] Please complete your 360° assessment – ${periodName}`
    : `[Reminder] Please fill in your 360° assessment – ${periodName}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#097eb9;padding:20px 32px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">PRIEDS · 360° Feedback</p>
            <p style="margin:4px 0 0;color:#b7e7f7;font-size:13px;">${periodName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#0f172a;">
              ${isFollowUp ? "⚠️ 360° Assessment Follow Up" : "📝 360° Assessment Reminder"}
            </p>
            <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
              Hello <strong>${name}</strong>,<br><br>
              ${isFollowUp
                ? `This is a <strong>follow up</strong> to remind you that you still have <strong>${pendingCount} assessments</strong> unfinished for the <strong>${periodName}</strong> period. Please complete them before the period ends.`
                : `You have <strong>${pendingCount} 360° assessments</strong> to fill in for the <strong>${periodName}</strong> period. Please take a moment to complete them before the deadline.`
              }
            </p>
            <div style="background:#eef9fd;border:1px solid #b7e7f7;border-radius:10px;padding:14px 18px;margin:16px 0;">
              <p style="margin:0;font-size:13px;color:#097eb9;">📊 <strong>${pendingCount} assessments</strong> remaining</p>
            </div>
            <a href="${APP_URL}/360"
               style="display:inline-block;background:#097eb9;color:#ffffff;font-weight:bold;font-size:14px;
                      padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:8px;">
              Fill in 360° Assessment →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              This email was sent automatically by the Performance Management system. Please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, periodId, test }: { type: "initial" | "followup"; periodId: string; test?: boolean } = await req.json();

  if (!type || !periodId)
    return NextResponse.json({ error: "type and periodId are required." }, { status: 400 });

  const period = await prisma.feedbackPeriod.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Period not found." }, { status: 404 });

  // Trial mode: send one email to the logged-in admin only, so the layout can
  // be checked before blasting everyone.
  if (test) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
    if (!me?.email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
    const { subject, html } = buildEmail360Html({ name: me.name ?? me.email, type, periodName: period.name, pendingCount: 5 });
    try {
      await createTransporter().sendMail({ from: `Performance Management <${GMAIL_USER}>`, to: me.email, subject: `[TEST] ${subject}`, html });
      return NextResponse.json({ success: true, message: `Test email sent to ${me.email}. Check your inbox before blasting everyone.`, results: [{ name: me.name ?? "-", email: me.email, status: "sent" }] });
    } catch (err) {
      return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Failed to send test email.", results: [] });
    }
  }

  // Recipients = every active employee whose assignments are not fully
  // submitted yet. Computed from the assignment rule (not from existing
  // response rows) so the very first blast reaches everyone.
  const profiles = await loadProfilesLite();
  const activeProfiles = profiles.filter((p) => p.active);
  const manualPeers = await prisma.feedbackManualPeer.findMany({
    where: { OR: [{ periodId: null }, { periodId }] },
  });
  const manualByRater = new Map<string, string[]>();
  for (const mp of manualPeers)
    manualByRater.set(mp.raterId, [...(manualByRater.get(mp.raterId) ?? []), mp.rateeId]);

  const submittedRows = await prisma.feedbackResponse.groupBy({
    by: ["raterId", "rateeId"],
    where: { periodId, submitted: true },
  });
  const submittedPairs = new Set(submittedRows.map((r) => `${r.raterId}:${r.rateeId}`));

  const users = await prisma.user.findMany({
    where: { id: { in: activeProfiles.map((p) => p.userId) } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const excludedPairs = await loadPeerExclusions();
  const usersWithPending: { id: string; name: string | null; email: string | null; pendingCount: number }[] = [];
  for (const p of activeProfiles) {
    const assignments = computeAssignmentsFor(p.userId, activeProfiles, manualByRater.get(p.userId) ?? [], excludedPairs);
    const pendingCount = assignments.filter((a) => !submittedPairs.has(`${p.userId}:${a.ratee.userId}`)).length;
    if (pendingCount > 0) {
      const u = userById.get(p.userId);
      usersWithPending.push({ id: p.userId, name: u?.name ?? p.name, email: u?.email ?? null, pendingCount });
    }
  }

  if (usersWithPending.length === 0) {
    return NextResponse.json({ success: true, message: "All assessments are complete. No emails were sent.", results: [] });
  }

  const transporter = createTransporter();
  const results: { name: string; email: string; status: "sent" | "skipped" | "error"; reason?: string; error?: string }[] = [];

  for (const user of usersWithPending) {
    if (!user.email) {
      results.push({ name: user.name ?? "-", email: "-", status: "error", error: "No email address" });
      continue;
    }

    const pendingCount = user.pendingCount;
    const { subject, html } = buildEmail360Html({ name: user.name ?? user.email, type, periodName: period.name, pendingCount });

    try {
      await transporter.sendMail({ from: `Performance Management <${GMAIL_USER}>`, to: user.email, subject, html });
      results.push({ name: user.name ?? "-", email: user.email, status: "sent" });
    } catch (err) {
      results.push({ name: user.name ?? "-", email: user.email, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  const errCount = results.filter((r) => r.status === "error").length;
  const parts = [];
  if (sentCount > 0) parts.push(`${sentCount} emails sent`);
  if (errCount > 0) parts.push(`${errCount} failed`);

  return NextResponse.json({ success: sentCount > 0, message: parts.join(", ") + ".", results });
}
