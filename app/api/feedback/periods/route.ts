import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackBootstrap();
  const periods = await prisma.feedbackPeriod.findMany({
    orderBy: [{ year: "desc" }, { half: "desc" }],
  });
  return NextResponse.json(periods);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const half = body.half === "END" ? "END" : "MID";
  const year = parseInt(String(body.year), 10);
  if (!year || year < 2000) return NextResponse.json({ error: "Invalid year." }, { status: 400 });

  const name = (half === "MID" ? "Mid Year " : "End Year ") + year;
  const existing = await prisma.feedbackPeriod.findUnique({ where: { year_half: { year, half } } });
  if (existing) return NextResponse.json({ error: "This period already exists." }, { status: 400 });

  const period = await prisma.feedbackPeriod.create({ data: { name, half, year } });
  return NextResponse.json(period, { status: 201 });
}
