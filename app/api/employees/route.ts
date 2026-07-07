import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const division = searchParams.get("division");
  const isActiveParam = searchParams.get("isActive");

  const where: Record<string, unknown> = {};
  if (isActiveParam === "true") where.isActive = true;
  if (isActiveParam === "false") where.isActive = false;
  if (division) where.division = division;

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ division: "asc" }, { name: "asc" }],
    select: { id: true, name: true, division: true, position: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(employees);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, division, position, isActive } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const employee = await prisma.employee.create({
    data: { name: name.trim(), division: division?.trim() || null, position: position?.trim() || null, isActive: isActive !== false },
  });
  return NextResponse.json(employee);
}
