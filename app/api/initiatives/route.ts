import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Verify the signed-in user owns the objective behind this KR assignment
// (i.e. it's their Division OKR) — or is an admin.
async function ownsKRAssignment(krAssignmentId: string, userId: string, isAdmin: boolean) {
  const kra = await prisma.kRAssignment.findUnique({
    where: { id: krAssignmentId },
    include: { assignment: { include: { objective: { select: { userId: true } } } } },
  });
  if (!kra) return { ok: false as const, status: 404, error: "KR assignment not found." };
  if (!isAdmin && kra.assignment.objective.userId !== userId)
    return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

// POST — create a free-text initiative under a member's KR assignment
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const krAssignmentId = String(body.krAssignmentId || "");
  const title = String(body.title || "").trim();
  if (!krAssignmentId || !title)
    return NextResponse.json({ error: "krAssignmentId and title are required." }, { status: 400 });

  const own = await ownsKRAssignment(krAssignmentId, session.user.id, session.user.role === "ADMIN");
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const last = await prisma.initiative.findFirst({
    where: { krAssignmentId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const initiative = await prisma.initiative.create({
    data: { krAssignmentId, title, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json(initiative, { status: 201 });
}
