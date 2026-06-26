import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CATS = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

function genCode(name: string) {
  const base = name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) || "COMP";
  return base + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// POST /api/feedback/competencies/bulk
// body: { names: string[], category: string, department?: string }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { names, category, department } = body;

  if (!Array.isArray(names) || names.length === 0)
    return NextResponse.json({ error: "names harus array dan tidak kosong." }, { status: 400 });
  if (!CATS.includes(category))
    return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });

  const max = await prisma.competency.aggregate({ _max: { sortOrder: true } });
  let sortOrder = (max._max.sortOrder ?? 0) + 1;

  const created = [];
  const errors = [];

  for (const rawName of names) {
    const name = String(rawName).trim();
    if (!name) continue;
    try {
      const comp = await prisma.competency.create({
        data: {
          code: genCode(name),
          name,
          category,
          department: department || null,
          active: true,
          sortOrder: sortOrder++,
        },
      });
      created.push(comp);
    } catch {
      errors.push(`Gagal membuat: "${name}"`);
    }
  }

  return NextResponse.json({ created: created.length, errors }, { status: 201 });
}
