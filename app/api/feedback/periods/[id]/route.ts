import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  if (body.releaseReports !== undefined) data.releaseReports = !!body.releaseReports;

  const period = await prisma.feedbackPeriod.update({ where: { id }, data });
  return NextResponse.json(period);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.feedbackPeriod.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
