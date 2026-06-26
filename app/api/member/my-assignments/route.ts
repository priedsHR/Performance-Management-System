import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MEMBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quarterId = req.nextUrl.searchParams.get("quarterId");
  if (!quarterId) return NextResponse.json({ error: "quarterId wajib diisi." }, { status: 400 });

  const teamMember = await prisma.teamMember.findUnique({
    where: { userId: session.user.id },
  });

  if (!teamMember) return NextResponse.json({ linked: false, objectives: [] });

  const assignments = await prisma.objectiveAssignment.findMany({
    where: {
      memberId: teamMember.id,
      objective: { quarterId },
    },
    include: {
      objective: { select: { id: true, title: true, weight: true } },
      krAssignments: {
        include: {
          keyResult: { select: { id: true, title: true, target: true, unit: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  // Group by objective
  const objMap = new Map<string, {
    id: string; title: string; weight: number;
    krs: { id: string; title: string; target: number; unit: string; weight: number; progress: number; achievement: number }[];
  }>();

  for (const a of assignments) {
    const obj = a.objective;
    if (!objMap.has(obj.id)) {
      objMap.set(obj.id, { id: obj.id, title: obj.title, weight: obj.weight, krs: [] });
    }
    for (const kra of a.krAssignments) {
      const kr = kra.keyResult;
      const effectiveTarget = kra.target ?? kr.target;
      const achievement = effectiveTarget > 0 ? Math.min((kra.progress / effectiveTarget) * 100, 100) : 0;
      objMap.get(obj.id)!.krs.push({
        id: kra.id,
        title: kr.title,
        target: effectiveTarget,
        unit: kr.unit,
        weight: kra.weight,
        progress: kra.progress,
        achievement,
      });
    }
  }

  return NextResponse.json({ linked: true, objectives: Array.from(objMap.values()) });
}
