import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function canEdit(session: { user: { role: string; isExecutive?: boolean; division?: string | null } }, division: string) {
  return session.user.role === "ADMIN" || !!session.user.isExecutive || session.user.division === division;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ann = await prisma.slideAnnotation.findUnique({ where: { id } });
  if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(session, ann.division)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json();
  const updated = await prisma.slideAnnotation.update({
    where: { id },
    data: {
      ...(b.content !== undefined && { content: String(b.content) }),
      ...(b.x !== undefined && { x: Number(b.x) }),
      ...(b.y !== undefined && { y: Number(b.y) }),
      ...(b.w !== undefined && { w: Number(b.w) }),
      ...(b.h !== undefined && { h: Number(b.h) }),
      ...(b.fontSize !== undefined && { fontSize: Number(b.fontSize) }),
      ...(b.color !== undefined && { color: String(b.color) }),
      ...(b.z !== undefined && { z: Number(b.z) }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ann = await prisma.slideAnnotation.findUnique({ where: { id } });
  if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(session, ann.division)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.slideAnnotation.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
