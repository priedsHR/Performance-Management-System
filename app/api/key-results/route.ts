import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const kr = await prisma.keyResult.create({
    data: {
      title: body.title,
      target: Number(body.target),
      unit: body.unit,
      weight: Number(body.weight ?? 0),
      teamProgress: Number(body.teamProgress ?? 0),
      objectiveId: body.objectiveId,
    },
  });
  return NextResponse.json(kr, { status: 201 });
}
