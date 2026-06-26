import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcObjectiveAchievement, aggregateKRProgress } from "@/lib/calculations";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarterId");
  if (!quarterId) return NextResponse.json({ error: "quarterId required" }, { status: 400 });

  const leads = await prisma.user.findMany({
    where: { role: "LEAD" },
    orderBy: [{ division: "asc" }, { name: "asc" }],
    select: { id: true, name: true, division: true },
  });

  const results = await Promise.all(
    leads.map(async (lead) => {
      const objectivesRaw = await prisma.objective.findMany({
        where: { userId: lead.id, quarterId },
        include: { keyResults: true },
      });

      const memberCount = await prisma.teamMember.count({ where: { leadId: lead.id } });

      let allKRAssignments: { keyResultId: string; weight: number; progress: number; target?: number | null }[] = [];
      if (objectivesRaw.length > 0) {
        const quarterObjectiveIds = objectivesRaw.map((o) => o.id);
        const members = await prisma.teamMember.findMany({
          where: { leadId: lead.id },
          include: {
            assignments: {
              where: { objectiveId: { in: quarterObjectiveIds } },
              include: { krAssignments: true },
            },
          },
        });
        allKRAssignments = members.flatMap((m) => m.assignments.flatMap((a) => a.krAssignments));
      }

      const objectives = aggregateKRProgress(objectivesRaw, allKRAssignments);
      const totalW = objectives.reduce((s, o) => s + o.weight, 0);
      const achievement =
        totalW > 0
          ? objectives.reduce((s, o) => s + (calcObjectiveAchievement(o) * o.weight) / totalW, 0)
          : 0;

      return {
        leadId: lead.id,
        name: lead.name,
        division: lead.division,
        achievement,
        memberCount,
        objectiveCount: objectives.length,
      };
    })
  );

  return NextResponse.json({ leads: results });
}
