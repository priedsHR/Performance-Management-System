import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Ownership: initiative -> KR -> objective must belong to the signed-in user
// (their Division OKR), unless they're an admin.
async function ownsInitiative(id: string, userId: string, isAdmin: boolean) {
  const init = await prisma.initiative.findUnique({
    where: { id },
    include: { keyResult: { include: { objective: { select: { userId: true } } } } },
  });
  if (!init) return { ok: false as const, status: 404, error: "Initiative not found." };
  if (!isAdmin && init.keyResult.objective.userId !== userId)
    return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const own = await ownsInitiative(id, session.user.id, session.user.role === "ADMIN");
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const body = await req.json();
  const initiative = await prisma.initiative.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.target !== undefined && { target: Number(body.target) || 0 }),
      ...(body.actual !== undefined && { actual: Number(body.actual) || 0 }),
      ...(body.unit !== undefined && { unit: String(body.unit) }),
      ...(body.resultNote !== undefined && { resultNote: body.resultNote ? String(body.resultNote) : null }),
      ...(body.picId !== undefined && { picId: body.picId ? String(body.picId) : null }),
    },
    include: { pic: { select: { id: true, name: true } } },
  });
  return NextResponse.json(initiative);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const own = await ownsInitiative(id, session.user.id, session.user.role === "ADMIN");
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  await prisma.initiative.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
