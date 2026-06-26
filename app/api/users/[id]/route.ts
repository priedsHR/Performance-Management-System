import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.email !== undefined) data.email = body.email;
  if (body.role !== undefined) data.role = body.role;
  if (body.division !== undefined) data.division = body.division;
  if (body.password) data.password = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, division: true, createdAt: true },
  });

  // Handle TeamMember link
  if (body.teamMemberId !== undefined) {
    // Clear any existing link for this user
    const existingLink = await prisma.teamMember.findUnique({ where: { userId: id } });
    if (existingLink) {
      await prisma.teamMember.update({ where: { id: existingLink.id }, data: { userId: null } });
    }
    // Set new link if provided
    if (body.teamMemberId) {
      await prisma.teamMember.update({ where: { id: body.teamMemberId }, data: { userId: id } });
    }
  }

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
