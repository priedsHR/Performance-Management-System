import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// The signed-in user owns the objective behind this KR (their Division OKR),
// or is an admin.
async function ownsKeyResult(keyResultId: string, userId: string, isAdmin: boolean) {
  const kr = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
    include: { objective: { select: { userId: true } } },
  });
  if (!kr) return { ok: false as const, status: 404, error: "Key result not found." };
  if (!isAdmin && kr.objective.userId !== userId)
    return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

// GET — list initiatives for a KR (owner, admin, or an executive viewing OKR)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keyResultId = req.nextUrl.searchParams.get("keyResultId");
  if (!keyResultId) return NextResponse.json({ error: "keyResultId is required." }, { status: 400 });

  const kr = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
    include: { objective: { select: { userId: true } } },
  });
  if (!kr) return NextResponse.json({ error: "Key result not found." }, { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  const isExec = !!session.user.isExecutive;
  if (!isAdmin && !isExec && kr.objective.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const initiatives = await prisma.initiative.findMany({
    where: { keyResultId },
    include: {
      pic: { select: { id: true, name: true } },
      monthly: { orderBy: [{ year: "asc" }, { month: "asc" }] },
    },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(initiatives);
}

// POST — add an initiative (action plan) under a KR, optionally assigned to a PIC
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const keyResultId = String(body.keyResultId || "");
  const title = String(body.title || "").trim();
  if (!keyResultId || !title)
    return NextResponse.json({ error: "keyResultId and title are required." }, { status: 400 });

  const own = await ownsKeyResult(keyResultId, session.user.id, session.user.role === "ADMIN");
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const last = await prisma.initiative.findFirst({
    where: { keyResultId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const initiative = await prisma.initiative.create({
    data: {
      keyResultId,
      title,
      picId: body.picId ? String(body.picId) : null,
      target: body.target != null ? Number(body.target) : 1,
      actual: body.actual != null ? Number(body.actual) : 0,
      unit: body.unit != null ? String(body.unit) : "",
      resultNote: body.resultNote != null ? String(body.resultNote) : null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    include: { pic: { select: { id: true, name: true } } },
  });
  return NextResponse.json(initiative, { status: 201 });
}
