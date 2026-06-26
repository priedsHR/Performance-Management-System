import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { isActive } = await req.json();

  const schedule = await prisma.reminderSchedule.update({
    where: { id },
    data: { isActive },
    include: { quarter: { select: { id: true, name: true } } },
  });

  return NextResponse.json(schedule);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.reminderSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
