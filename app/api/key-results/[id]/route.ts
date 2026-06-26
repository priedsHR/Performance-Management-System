import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Lead bisa override leadProgress untuk anggota divisinya
  // Member hanya bisa update teamProgress miliknya sendiri
  const kr = await prisma.keyResult.findUnique({
    where: { id },
    include: { objective: { include: { user: true } } },
  });
  if (!kr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = kr.objective.user;
  const isAdmin = session.user.role === "ADMIN";
  const isLead = session.user.role === "LEAD" && owner.division === session.user.division;
  const isOwner = owner.id === session.user.id;

  if (!isAdmin && !isLead && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Member tidak bisa set leadProgress
  const data: Record<string, unknown> = {};
  if (body.title !== undefined && (isAdmin || isLead || isOwner)) data.title = body.title;
  if (body.target !== undefined && (isAdmin || isLead || isOwner)) data.target = Number(body.target);
  if (body.unit !== undefined && (isAdmin || isLead || isOwner)) data.unit = body.unit;
  if (body.weight !== undefined && (isAdmin || isLead || isOwner)) data.weight = Number(body.weight);
  if (body.teamProgress !== undefined) data.teamProgress = Number(body.teamProgress);
  if ("leadProgress" in body && (isAdmin || isLead)) {
    data.leadProgress = body.leadProgress !== null ? Number(body.leadProgress) : null;
  }

  const updated = await prisma.keyResult.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.keyResult.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
