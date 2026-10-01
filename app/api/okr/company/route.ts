import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Company-wide OKR view for C-Level (isExecutive) and admins: every
// department's objectives for a quarter, with KRs and initiatives.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // All employees can view all departments' OKR (read-only).

  const quarterId = req.nextUrl.searchParams.get("quarterId");
  if (!quarterId) return NextResponse.json({ error: "quarterId is required." }, { status: 400 });

  const objectives = await prisma.objective.findMany({
    where: { quarterId },
    include: {
      user: { select: { id: true, name: true, division: true } },
      keyResults: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          initiatives: {
            orderBy: { sortOrder: "asc" },
            include: { pic: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  // Group by DIVISION, merging every owner in the same division into one card.
  const ORDER = ["HR", "Finance", "Marketing", "Partnership", "Sales", "Tech-Product", "Tech-Project", "Executive"];
  const deptMap = new Map<string, {
    division: string;
    leadNames: string[];
    objectives: typeof objectives;
  }>();
  for (const o of objectives) {
    const division = o.user.division || o.user.name;
    if (!deptMap.has(division)) deptMap.set(division, { division, leadNames: [], objectives: [] });
    const d = deptMap.get(division)!;
    d.objectives.push(o);
    if (!d.leadNames.includes(o.user.name)) d.leadNames.push(o.user.name);
  }

  const departments = Array.from(deptMap.values()).sort((a, b) => {
    const ia = ORDER.indexOf(a.division), ib = ORDER.indexOf(b.division);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.division.localeCompare(b.division);
  });
  return NextResponse.json({ departments });
}
