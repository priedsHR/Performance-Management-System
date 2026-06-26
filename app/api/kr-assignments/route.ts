import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  // body: { assignmentId, keyResultId, weight?, progress? }
  const kra = await prisma.kRAssignment.create({
    data: {
      assignmentId: body.assignmentId,
      keyResultId: body.keyResultId,
      weight: Number(body.weight ?? 0),
      progress: Number(body.progress ?? 0),
      target: body.target !== undefined && body.target !== null ? Number(body.target) : null,
    },
  });
  return NextResponse.json(kra, { status: 201 });
}
