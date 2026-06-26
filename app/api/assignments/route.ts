import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();

  const assignment = await prisma.objectiveAssignment.upsert({
    where: { memberId_objectiveId: { memberId: body.memberId, objectiveId: body.objectiveId } },
    update: { weight: Number(body.weight) },
    create: { memberId: body.memberId, objectiveId: body.objectiveId, weight: Number(body.weight) },
    include: { krAssignments: true },
  });

  return NextResponse.json(assignment, { status: 201 });
}
