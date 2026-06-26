import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcMemberAchievement } from "@/lib/calculations";
import type { ObjWithKRs } from "@/lib/calculations";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || (session.user.role !== "LEAD" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const leadId = searchParams.get("leadId") ?? session.user.id;

  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  // Get all quarters, sorted chronologically
  const quarters = await prisma.quarter.findMany({
    orderBy: [{ year: "asc" }, { quarter: "asc" }],
  });

  const trendData: { quarterId: string; quarterName: string; quarterLabel: string; achievement: number }[] = [];

  for (const q of quarters) {
    // Get objectives for this quarter
    const objectives = await prisma.objective.findMany({
      where: { userId: leadId, quarterId: q.id },
      include: { keyResults: true },
    });

    if (objectives.length === 0) continue;

    const objMap = new Map<string, ObjWithKRs>(
      objectives.map((o) => [
        o.id,
        {
          id: o.id,
          title: o.title,
          weight: o.weight,
          keyResults: o.keyResults.map((kr) => ({
            id: kr.id,
            title: kr.title,
            target: kr.target,
            unit: kr.unit,
            weight: kr.weight,
            teamProgress: kr.teamProgress,
            leadProgress: kr.leadProgress,
          })),
        },
      ])
    );

    const assignments = await prisma.objectiveAssignment.findMany({
      where: { memberId, objective: { userId: leadId, quarterId: q.id } },
      include: { krAssignments: true },
    });

    if (assignments.length === 0) continue;

    const calcAssignments = assignments.map((a) => ({
      weight: a.weight,
      objectiveId: a.objectiveId,
      krAssignments: a.krAssignments.map((kra) => ({
        keyResultId: kra.keyResultId,
        weight: kra.weight,
        progress: kra.progress,
        target: kra.target,
      })),
    }));

    const achievement = calcMemberAchievement(calcAssignments, Array.from(objMap.values()));

    trendData.push({
      quarterId: q.id,
      quarterName: q.name,
      quarterLabel: `Q${q.quarter} ${q.year}`,
      achievement,
    });
  }

  return NextResponse.json({ trend: trendData });
}
