import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function canEdit(session: { user: { role: string; isExecutive?: boolean; division?: string | null } }, division: string) {
  return session.user.role === "ADMIN" || !!session.user.isExecutive || session.user.division === division;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const division = req.nextUrl.searchParams.get("division");
  const quarterId = req.nextUrl.searchParams.get("quarterId");
  if (!division || !quarterId) return NextResponse.json({ error: "division and quarterId are required." }, { status: 400 });

  const slides = await prisma.presentationSlide.findMany({
    where: { division, quarterId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ slides });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const division = String(b.division || "");
  const quarterId = String(b.quarterId || "");
  if (!division || !quarterId) return NextResponse.json({ error: "division and quarterId required." }, { status: 400 });
  if (!canEdit(session, division)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const last = await prisma.presentationSlide.findFirst({
    where: { division, quarterId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true },
  });
  const slide = await prisma.presentationSlide.create({
    data: { division, quarterId, title: String(b.title || "New slide"), sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json(slide, { status: 201 });
}
