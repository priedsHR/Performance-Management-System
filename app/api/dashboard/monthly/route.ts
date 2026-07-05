import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcMemberAchievement, type ObjWithKRs } from "@/lib/calculations";

// Monthly OKR progress series for one member. On every call it also upserts a
// snapshot for the current month & active quarter, so history builds itself.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const memberIdParam = searchParams.get("memberId");

  // default: the member record linked to the logged-in user
  const member = memberIdParam
    ? await prisma.teamMember.findUnique({ where: { id: memberIdParam } })
    : await prisma.teamMember.findUnique({ where: { userId: session.user.id } });
  if (!member) return NextResponse.json({ series: [], linked: false });

  const isSelf = member.userId === session.user.id;
  const isLead = member.leadId === session.user.id;
  if (!isSelf && !isLead && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // capture current month for the active quarter
  const activeQuarter = await prisma.quarter.findFirst({ where: { isActive: true } });
  if (activeQuarter) {
    const objectives = await prisma.objective.findMany({
      where: { userId: member.leadId, quarterId: activeQuarter.id },
      include: { keyResults: true },
    });
    const objs: ObjWithKRs[] = objectives.map((o) => ({
      id: o.id, title: o.title, weight: o.weight,
      keyResults: o.keyResults.map((kr) => ({
        id: kr.id, title: kr.title, target: kr.target, unit: kr.unit,
        weight: kr.weight, teamProgress: kr.teamProgress, leadProgress: kr.leadProgress,
      })),
    }));
    const assignments = await prisma.objectiveAssignment.findMany({
      where: { memberId: member.id, objectiveId: { in: objectives.map((o) => o.id) } },
      include: { krAssignments: true },
    });
    if (assignments.length && objs.length) {
      const achievement = calcMemberAchievement(
        assignments.map((a) => ({
          weight: a.weight,
          objectiveId: a.objectiveId,
          krAssignments: a.krAssignments.map((k) => ({
            keyResultId: k.keyResultId, weight: k.weight, progress: k.progress, target: k.target,
          })),
        })),
        objs
      );
      const month = new Date().toISOString().slice(0, 7);
      await prisma.progressSnapshot.upsert({
        where: { memberId_quarterId_month: { memberId: member.id, quarterId: activeQuarter.id, month } },
        update: { achievement },
        create: { memberId: member.id, quarterId: activeQuarter.id, month, achievement },
      });
    }
  }

  const snapshots = await prisma.progressSnapshot.findMany({
    where: { memberId: member.id },
    orderBy: { month: "asc" },
  });
  const quarters = await prisma.quarter.findMany({ select: { id: true, name: true } });
  const qName = new Map(quarters.map((q) => [q.id, q.name]));

  return NextResponse.json({
    linked: true,
    memberName: member.name,
    series: snapshots.map((s) => ({
      month: s.month,
      achievement: Math.round(s.achievement * 10) / 10,
      quarter: qName.get(s.quarterId) ?? "",
    })),
  });
}
