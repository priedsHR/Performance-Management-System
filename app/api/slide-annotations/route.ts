import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// A user may edit a division's slides if they're admin, an executive, or they
// belong to that division.
function canEdit(session: { user: { role: string; isExecutive?: boolean; division?: string | null } }, division: string) {
  return session.user.role === "ADMIN" || !!session.user.isExecutive || session.user.division === division;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const division = req.nextUrl.searchParams.get("division");
  const quarterId = req.nextUrl.searchParams.get("quarterId");
  if (!division || !quarterId) return NextResponse.json({ error: "division and quarterId are required." }, { status: 400 });

  const annotations = await prisma.slideAnnotation.findMany({
    where: { division, quarterId },
    orderBy: { z: "asc" },
  });
  return NextResponse.json({ annotations, canEdit: canEdit(session, division) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const division = String(body.division || "");
  const quarterId = String(body.quarterId || "");
  const slideKey = String(body.slideKey || "");
  const kind = body.kind === "image" ? "image" : "text";
  if (!division || !quarterId || !slideKey) return NextResponse.json({ error: "division, quarterId, slideKey required." }, { status: 400 });
  if (!canEdit(session, division)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const content = String(body.content ?? (kind === "text" ? "Text" : ""));
  // Guard against oversized image payloads (~2MB data URL).
  if (kind === "image" && content.length > 2_800_000)
    return NextResponse.json({ error: "Image too large — please use one under ~2MB." }, { status: 413 });

  const ann = await prisma.slideAnnotation.create({
    data: {
      division, quarterId, slideKey, kind, content,
      x: body.x ?? 30, y: body.y ?? 30,
      w: body.w ?? (kind === "image" ? 30 : 25),
      h: body.h ?? (kind === "image" ? 25 : 10),
      fontSize: body.fontSize ?? 18,
      color: body.color ?? "#0f172a",
      z: body.z ?? 1,
    },
  });
  return NextResponse.json(ann, { status: 201 });
}
