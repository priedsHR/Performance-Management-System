import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcObjectiveAchievement, type ObjWithKRs } from "@/lib/calculations";

// North Star series for management: division OKR achievement per quarter plus
// the company average — one call, chart-ready.
export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "LEAD"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [quarters, leads, objectives] = await Promise.all([
    prisma.quarter.findMany({ orderBy: [{ year: "asc" }, { quarter: "asc" }], select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["LEAD", "ADMIN"] } }, select: { id: true, division: true } }),
    prisma.objective.findMany({ include: { keyResults: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const divisionOf = new Map(leads.map((l) => [l.id, l.division || "Other"]));
  const points = [];
  const divisionsSeen = new Set<string>();

  for (const q of quarters) {
    // division → weighted objective achievement
    const byDivision = new Map<string, { num: number; den: number }>();
    for (const o of objectives) {
      if (o.quarterId !== q.id) continue;
      const division = divisionOf.get(o.userId);
      if (!division) continue;
      const obj: ObjWithKRs = {
        id: o.id, title: o.title, weight: o.weight,
        keyResults: o.keyResults.map((kr) => ({
          id: kr.id, title: kr.title, target: kr.target, unit: kr.unit,
          weight: kr.weight, teamProgress: kr.teamProgress, leadProgress: kr.leadProgress,
        })),
      };
      const ach = calcObjectiveAchievement(obj);
      const cur = byDivision.get(division) ?? { num: 0, den: 0 };
      cur.num += ach * o.weight;
      cur.den += o.weight;
      byDivision.set(division, cur);
    }
    if (byDivision.size === 0) continue;
    const point: Record<string, string | number | null> = { quarter: q.name };
    const vals: number[] = [];
    for (const [division, { num, den }] of byDivision) {
      const v = den ? Math.round((num / den) * 10) / 10 : 0;
      point[division] = v;
      vals.push(v);
      divisionsSeen.add(division);
    }
    point["Company"] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    points.push(point);
  }

  return NextResponse.json({ points, divisions: [...divisionsSeen].sort() });
}
