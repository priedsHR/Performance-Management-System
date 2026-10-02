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
  const slide = await prisma.presentationSlide.findUnique({ where: { id } });
  if (!slide) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(session, slide.division)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json();
  const updated = await prisma.presentationSlide.update({
    where: { id },
    data: {
      ...(b.title !== undefined && { title: String(b.title) }),
      ...(b.sortOrder !== undefined && { sortOrder: Number(b.sortOrder) }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const slide = await prisma.presentationSlide.findUnique({ where: { id } });
  if (!slide) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(session, slide.division)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Remove the slide and any annotations placed on it.
  await prisma.slideAnnotation.deleteMany({ where: { division: slide.division, quarterId: slide.quarterId, slideKey: `custom:${id}` } });
  await prisma.presentationSlide.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
