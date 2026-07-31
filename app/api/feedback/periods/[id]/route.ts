import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { build360Email, create360Transporter, has360Email, FROM_360 } from "@/lib/feedback/email360";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.isActive === true) {
    // Only one active period at a time.
    await prisma.feedbackPeriod.updateMany({ data: { isActive: false }, where: { isActive: true } });
    data.isActive = true;
  } else if (body.isActive === false) {
    data.isActive = false;
  }
  let justReleased = false;
  if (body.releaseReports !== undefined) {
    data.releaseReports = !!body.releaseReports;
    if (body.releaseReports) {
      const before = await prisma.feedbackPeriod.findUnique({ where: { id }, select: { releaseReports: true } });
      justReleased = !before?.releaseReports; // transition false -> true
    }
  }

  const period = await prisma.feedbackPeriod.update({ where: { id }, data });

  // Notify all active employees that their report is available (only on the
  // moment it's first released, and only if email is configured).
  let notified = 0;
  if (justReleased && has360Email()) {
    const recipients = await prisma.user.findMany({
      where: { feedbackProfile: { active: true } },
      select: { name: true, email: true },
    });
    const transporter = create360Transporter();
    for (const u of recipients) {
      if (!u.email) continue;
      const { subject, html } = build360Email({ name: u.name ?? u.email, kind: "report", periodName: period.name, deadline: null, pendingCount: 0 });
      try { await transporter.sendMail({ from: FROM_360, to: u.email, subject, html }); notified++; } catch { /* skip */ }
    }
  }

  return NextResponse.json({ ...period, notified });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.feedbackPeriod.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
