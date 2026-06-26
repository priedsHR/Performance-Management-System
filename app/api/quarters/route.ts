import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quarters = await prisma.quarter.findMany({ orderBy: [{ year: "desc" }, { quarter: "desc" }] });
  return NextResponse.json(quarters);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["ADMIN", "LEAD"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const quarter = await prisma.quarter.create({
    data: {
      name: body.name,
      year: Number(body.year),
      quarter: Number(body.quarter),
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isActive: body.isActive ?? false,
    },
  });
  return NextResponse.json(quarter, { status: 201 });
}
