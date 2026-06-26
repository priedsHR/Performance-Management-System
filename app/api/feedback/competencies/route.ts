import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";

const CATS = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackBootstrap();
  const comps = await prisma.competency.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(comps);
}

function genCode(name: string) {
  const base = name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) || "COMP";
  return base + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.name || !CATS.includes(body.category))
    return NextResponse.json({ error: "Nama dan kategori wajib." }, { status: 400 });

  const max = await prisma.competency.aggregate({ _max: { sortOrder: true } });
  const comp = await prisma.competency.create({
    data: {
      code: (body.code && String(body.code).trim()) || genCode(body.name),
      name: String(body.name).trim(),
      category: body.category,
      department: body.department || null,
      definition: body.definition || null,
      l1: body.l1 || null,
      l2: body.l2 || null,
      l3: body.l3 || null,
      l4: body.l4 || null,
      active: body.active !== false,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(comp, { status: 201 });
}
