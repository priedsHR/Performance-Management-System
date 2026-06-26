import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: { weight?: number; progress?: number; target?: number | null } = {};
  if (body.weight !== undefined) data.weight = Number(body.weight);
  if (body.progress !== undefined) data.progress = Number(body.progress);
  if ("target" in body) data.target = body.target !== null && body.target !== undefined ? Number(body.target) : null;
  const updated = await prisma.kRAssignment.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.kRAssignment.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
