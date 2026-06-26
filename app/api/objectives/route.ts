import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const objective = await prisma.objective.create({
    data: {
      title: body.title,
      weight: body.weight ?? 0,
      userId: body.userId ?? session.user.id,
      quarterId: body.quarterId,
    },
  });
  return NextResponse.json(objective, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarterId");
  const userId = searchParams.get("userId") ?? session.user.id;

  const objectives = await prisma.objective.findMany({
    where: {
      userId: session.user.role === "ADMIN" && searchParams.get("userId") ? userId : session.user.id,
      ...(quarterId ? { quarterId } : {}),
    },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(objectives);
}
