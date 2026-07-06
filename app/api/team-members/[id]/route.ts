import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const member = await prisma.teamMember.update({ where: { id }, data: { name: body.name } });
  return NextResponse.json(member);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const quarterId = req.nextUrl.searchParams.get("quarterId");
  if (!quarterId) return NextResponse.json({ error: "quarterId is required." }, { status: 400 });

  // Delete this quarter's assignments only
  const toDelete = await prisma.objectiveAssignment.findMany({
    where: { memberId: id, objective: { quarterId } },
    select: { id: true },
  });
  if (toDelete.length > 0) {
    await prisma.objectiveAssignment.deleteMany({ where: { id: { in: toDelete.map((a) => a.id) } } });
  }

  // If no assignments remain in any quarter, clean up the TeamMember record too
  const remaining = await prisma.objectiveAssignment.count({ where: { memberId: id } });
  if (remaining === 0) {
    await prisma.teamMember.delete({ where: { id } });
  }

  return new NextResponse(null, { status: 204 });
}
