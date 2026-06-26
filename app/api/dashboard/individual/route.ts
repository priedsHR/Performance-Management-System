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
  const quarterId = searchParams.get("quarterId");
  const leadId = searchParams.get("leadId") ?? session.user.id;

  if (!memberId || !quarterId) {
    return NextResponse.json({ error: "memberId and quarterId required" }, { status: 400 });
  }

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member || member.leadId !== leadId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Get objectives for this quarter (from the lead)
  const objectives = await prisma.objective.findMany({
    where: { userId: leadId, quarterId },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });

  // Build ObjWithKRs map
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

  // Get member's assignments for this quarter using explicit objective IDs (avoids relation filter issues)
  const quarterObjectiveIds = objectives.map((o) => o.id);
  const assignments = await prisma.objectiveAssignment.findMany({
    where: {
      memberId,
      objectiveId: { in: quarterObjectiveIds },
    },
    include: { krAssignments: true },
  });

  if (assignments.length === 0) {
    return NextResponse.json({
      member: { id: member.id, name: member.name },
      achievement: 0,
      assignments: [],
    });
  }

  const calcAssignments = assignments.map((a) => ({
    weight: a.weight,
    objectiveId: a.objectiveId,
    krAssignments: a.krAssignments.map((kra) => ({
      keyResultId: kra.keyResultId,
      weight: kra.weight,
      progress: kra.progress,
      target: kra.target,  // individual target override
    })),
  }));

  const achievement = calcMemberAchievement(calcAssignments, Array.from(objMap.values()));

  const responseAssignments = assignments.map((a) => {
    const obj = objMap.get(a.objectiveId);
    if (!obj) return null;

    // Per-member achievement using individual target where set
    const krTotalW = a.krAssignments.reduce((s, kra) => s + kra.weight, 0);
    const objAchievement = a.krAssignments.length > 0 && krTotalW > 0
      ? a.krAssignments.reduce((s, kra) => {
          const kr = obj.keyResults.find((k) => k.id === kra.keyResultId);
          if (!kr) return s;
          const effectiveTarget = (kra.target != null && kra.target > 0) ? kra.target : kr.target;
          if (effectiveTarget === 0) return s;
          const pct = Math.min((kra.progress / effectiveTarget) * 100, 100);
          return s + (pct * kra.weight) / krTotalW;
        }, 0)
      : 0;

    return {
      assignmentId: a.id,
      objectiveId: a.objectiveId,
      objectiveTitle: obj.title,
      weight: a.weight,
      achievement: objAchievement,
      krAssignments: a.krAssignments.map((kra) => {
        const kr = obj.keyResults.find((k) => k.id === kra.keyResultId);
        const effectiveTarget = (kra.target != null && kra.target > 0) ? kra.target : (kr?.target ?? 0);
        const krAchievement = effectiveTarget > 0
          ? Math.min((kra.progress / effectiveTarget) * 100, 100)
          : 0;
        return {
          kraId: kra.id,
          krId: kra.keyResultId,
          krTitle: kr?.title ?? "—",
          target: effectiveTarget,
          targetDivisi: kr?.target ?? 0,
          individualTarget: kra.target,
          unit: kr?.unit ?? "",
          weight: kra.weight,
          progress: kra.progress,
          achievement: krAchievement,
        };
      }),
    };
  }).filter(Boolean);

  return NextResponse.json({
    member: { id: member.id, name: member.name },
    achievement,
    assignments: responseAssignments,
  });
}
