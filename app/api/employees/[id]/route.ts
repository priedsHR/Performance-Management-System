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
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.division !== undefined) data.division = body.division?.trim() || null;
  if (body.position !== undefined) data.position = body.position?.trim() || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const employee = await prisma.employee.update({ where: { id }, data });
  return NextResponse.json(employee);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.employee.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
