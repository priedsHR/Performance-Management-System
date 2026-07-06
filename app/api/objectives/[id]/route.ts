import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Cek kepemilikan (kecuali admin)
  if (session.user.role !== "ADMIN") {
    const obj = await prisma.objective.findUnique({ where: { id } });
    if (!obj || obj.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Members cannot edit once SUBMITTED
    if (obj.status === "SUBMITTED" && body.status !== "DRAFT") {
      return NextResponse.json({ error: "OKR already submitted, cannot be edited." }, { status: 400 });
    }
  }

  const objective = await prisma.objective.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.weight !== undefined && { weight: Number(body.weight) }),
      ...(body.status !== undefined && {
        status: body.status,
        submittedAt: body.status === "SUBMITTED" ? new Date() : null,
      }),
    },
  });
  return NextResponse.json(objective);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (session.user.role !== "ADMIN") {
    const obj = await prisma.objective.findUnique({ where: { id } });
    if (!obj || obj.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (obj.status === "SUBMITTED") {
      return NextResponse.json({ error: "OKR already submitted." }, { status: 400 });
    }
  }

  await prisma.objective.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
