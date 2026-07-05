import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFeedbackSettings } from "@/lib/feedback/service";
import { scoreRatee } from "@/lib/feedback/scoring";
import { calcMemberAchievement, type ObjWithKRs } from "@/lib/calculations";

// 9-Box talent matrix (concept: Performance Management Review 2024)
// Potential  = 360 overall score  → Low <3 · Moderate 3.00-3.50 · High 3.51-4.00
// Performance = OKR achievement % → Low ≤70 · Moderate 71-90 · High >90
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const periodId = url.searchParams.get("periodId");
  const quarterId = url.searchParams.get("quarterId");
  if (!periodId || !quarterId)
    return NextResponse.json({ error: "periodId and quarterId are required." }, { status: 400 });

  const settings = await getFeedbackSettings();
  const profiles = await prisma.feedbackProfile.findMany({
    where: { active: true },
    include: { user: { select: { id: true, name: true } } },
  });

  // OKR side: objectives per lead for the quarter (cached), then each member's achievement
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId: { not: null } },
    include: { assignments: { include: { krAssignments: true, objective: { select: { quarterId: true } } } } },
  });
  const tmByUser = new Map(teamMembers.map((t) => [t.userId as string, t]));
  const objCache = new Map<string, ObjWithKRs[]>();
  async function leadObjectives(leadId: string): Promise<ObjWithKRs[]> {
    const hit = objCache.get(leadId);
    if (hit) return hit;
    const objectives = await prisma.objective.findMany({
      where: { userId: leadId, quarterId: quarterId as string },
      include: { keyResults: true },
    });
    const mapped = objectives.map((o) => ({
      id: o.id, title: o.title, weight: o.weight,
      keyResults: o.keyResults.map((kr) => ({
        id: kr.id, title: kr.title, target: kr.target, unit: kr.unit,
        weight: kr.weight, teamProgress: kr.teamProgress, leadProgress: kr.leadProgress,
      })),
    }));
    objCache.set(leadId, mapped);
    return mapped;
  }

  const rows = [];
  for (const p of profiles) {
    const r360 = await scoreRatee(p.userId, periodId, settings);
    let okr: number | null = null;
    const tm = tmByUser.get(p.userId);
    if (tm) {
      const objs = await leadObjectives(tm.leadId);
      const assignments = tm.assignments
        .filter((a) => a.objective.quarterId === quarterId)
        .map((a) => ({
          weight: a.weight,
          objectiveId: a.objectiveId,
          krAssignments: a.krAssignments.map((k) => ({
            keyResultId: k.keyResultId, weight: k.weight, progress: k.progress, target: k.target,
          })),
        }));
      if (assignments.length && objs.length) okr = calcMemberAchievement(assignments, objs);
    }
    const s360 = r360.hasData ? r360.overall : null;
    const pot = s360 == null ? null : s360 > 3.5 ? 2 : s360 >= 3 ? 1 : 0;
    const perf = okr == null ? null : okr > 90 ? 2 : okr > 70 ? 1 : 0;
    rows.push({
      userId: p.userId,
      name: p.user.name,
      position: p.position,
      department: p.department,
      score360: s360,
      okr,
      potential: pot,
      performance: perf,
    });
  }

  return NextResponse.json({ rows });
}
