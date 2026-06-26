import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, division: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const hashed = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hashed,
      role: body.role ?? "MEMBER",
      division: body.division ?? null,
    },
    select: { id: true, name: true, email: true, role: true, division: true, createdAt: true },
  });

  if (body.teamMemberId) {
    const existing = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (existing) await prisma.teamMember.update({ where: { id: existing.id }, data: { userId: null } });
    await prisma.teamMember.update({ where: { id: body.teamMemberId }, data: { userId: user.id } });
  }

  return NextResponse.json(user, { status: 201 });
}
