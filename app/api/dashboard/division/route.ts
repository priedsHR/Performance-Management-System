import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcObjectiveAchievement, calcMemberAchievement, aggregateKRProgress } from "@/lib/calculations";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["LEAD", "ADMIN", "MEMBER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarterId");

  // MEMBER: auto-resolve leadId from their division
  let leadId = searchParams.get("leadId") ?? session.user.id;
  if (session.user.role === "MEMBER") {
    if (!session.user.division) return NextResponse.json({ error: "Division not found." }, { status: 404 });
    const lead = await prisma.user.findFirst({ where: { role: "LEAD", division: session.user.division }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: "Division lead not found." }, { status: 404 });
    leadId = lead.id;
  }

  if (!quarterId) return NextResponse.json({ error: "quarterId required" }, { status: 400 });

  // 1. Lead's objectives for this quarter
  const objectivesRaw = await prisma.objective.findMany({
    where: { userId: leadId, quarterId },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });

  // 2. Team members + their assignments + KR assignments
  // Filter assignments by the objective IDs already fetched for this quarter (avoids relation filter issues)
  const quarterObjectiveIds = objectivesRaw.map((o) => o.id);
  const members = await prisma.teamMember.findMany({
    where: { leadId },
    include: {
      assignments: {
        where: { objectiveId: { in: quarterObjectiveIds } },
        include: { krAssignments: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // 3. Aggregate KR progress (sum of member contributions)
  const allKRAssignments = members.flatMap((m) => m.assignments.flatMap((a) => a.krAssignments));
  const objectives = aggregateKRProgress(objectivesRaw, allKRAssignments);

  // 4. Build per-KR member contribution map
  // kra.keyResultId → [{ memberId, memberName, progress }]
  type MemberContrib = { memberId: string; memberName: string; progress: number };
  const krContribMap = new Map<string, MemberContrib[]>();
  for (const member of members) {
    for (const assignment of member.assignments) {
      for (const kra of assignment.krAssignments) {
        if (!krContribMap.has(kra.keyResultId)) krContribMap.set(kra.keyResultId, []);
        krContribMap.get(kra.keyResultId)!.push({
          memberId: member.id,
          memberName: member.name,
          progress: kra.progress,
        });
      }
    }
  }

  // 5. Build response objectives
  const responseObjectives = objectives.map((obj) => {
    const achievement = calcObjectiveAchievement(obj);
    return {
      id: obj.id,
      title: obj.title,
      weight: obj.weight,
      achievement,
      keyResults: obj.keyResults.map((kr) => {
        const krAchievement = kr.target > 0
          ? Math.min(((kr.teamProgress + (kr.leadProgress ?? 0)) / kr.target) * 100, 100)
          : 0;
        const contribs = krContribMap.get(kr.id) ?? [];
        return {
          id: kr.id,
          title: kr.title,
          target: kr.target,
          unit: kr.unit,
          weight: kr.weight,
          teamProgress: kr.teamProgress,
          leadProgress: kr.leadProgress,
          achievement: krAchievement,
          memberContributions: contribs,
        };
      }),
    };
  });

  // 6. Member achievements
  const memberAchievements = members.map((m) => ({
    id: m.id,
    name: m.name,
    achievement: calcMemberAchievement(m.assignments, objectives),
  }));

  const totalObjW = objectives.reduce((s, o) => s + o.weight, 0);
  const divisionAchievement = totalObjW > 0
    ? objectives.reduce((s, o) => s + (calcObjectiveAchievement(o) * o.weight) / totalObjW, 0)
    : 0;

  return NextResponse.json({
    objectives: responseObjectives,
    members: memberAchievements,
    divisionAchievement,
  });
}
