import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAssignmentsFor, loadPeerExclusions, loadProfilesLite } from "@/lib/feedback/service";
import { build360Email, create360Transporter, FROM_360 } from "@/lib/feedback/email360";

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
    const { subject, html } = build360Email({ name: me.name ?? me.email, kind: type === "initial" ? "reminder" : "followup", periodName: period.name, deadline: period.deadline, pendingCount: 5 });
    try {
      await create360Transporter().sendMail({ from: FROM_360, to: me.email, subject: `[TEST] ${subject}`, html });
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

  const transporter = create360Transporter();
  const results: { name: string; email: string; status: "sent" | "skipped" | "error"; reason?: string; error?: string }[] = [];

  for (const user of usersWithPending) {
    if (!user.email) {
      results.push({ name: user.name ?? "-", email: "-", status: "error", error: "No email address" });
      continue;
    }

    const pendingCount = user.pendingCount;
    const { subject, html } = build360Email({ name: user.name ?? user.email, kind: type === "initial" ? "reminder" : "followup", periodName: period.name, deadline: period.deadline, pendingCount });

    try {
      await transporter.sendMail({ from: FROM_360, to: user.email, subject, html });
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
