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
  for (const f of ["name", "category", "department", "definition", "l1", "l2", "l3", "l4"]) {
    if (body[f] !== undefined) data[f] = body[f] === "" ? null : body[f];
  }
  if (body.active !== undefined) data.active = !!body.active;

  const comp = await prisma.competency.update({ where: { id }, data });
  return NextResponse.json(comp);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  // Remove from profiles + responses first to avoid orphan references.
  await prisma.profileCompetency.deleteMany({ where: { competencyId: id } });
  await prisma.feedbackResponse.deleteMany({ where: { competencyId: id } });
  await prisma.competency.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
