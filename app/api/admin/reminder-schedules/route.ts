import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeInitialNextRun } from "@/lib/reminder-issues";

export async function GET() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const schedules = await prisma.reminderSchedule.findMany({
    include: { quarter: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { type, quarterId, frequency, dayOfWeek, dayOfMonth, hourWIB } = body;

  if (!type || !quarterId || !frequency || hourWIB === undefined) {
    return NextResponse.json({ error: "Field tidak lengkap." }, { status: 400 });
  }
  if ((frequency === "weekly" || frequency === "biweekly") && dayOfWeek === undefined) {
    return NextResponse.json({ error: "Hari wajib dipilih untuk jadwal mingguan." }, { status: 400 });
  }
  if (frequency === "monthly" && !dayOfMonth) {
    return NextResponse.json({ error: "Tanggal wajib dipilih untuk jadwal bulanan." }, { status: 400 });
  }

  const nextRun = computeInitialNextRun(frequency, dayOfWeek ?? null, dayOfMonth ?? null, hourWIB);

  const schedule = await prisma.reminderSchedule.create({
    data: { type, quarterId, frequency, dayOfWeek: dayOfWeek ?? null, dayOfMonth: dayOfMonth ?? null, hourWIB, nextRun },
    include: { quarter: { select: { id: true, name: true } } },
  });

  return NextResponse.json(schedule);
}
