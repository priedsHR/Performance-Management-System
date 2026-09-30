import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Company-wide OKR view for C-Level (isExecutive) and admins: every
// department's objectives for a quarter, with KRs and initiatives.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && !session.user.isExecutive)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  // Group by owner (department lead)
  const deptMap = new Map<string, {
    ownerId: string;
    ownerName: string;
    division: string | null;
    objectives: typeof objectives;
  }>();
  for (const o of objectives) {
    const key = o.user.id;
    if (!deptMap.has(key))
      deptMap.set(key, { ownerId: o.user.id, ownerName: o.user.name, division: o.user.division, objectives: [] });
    deptMap.get(key)!.objectives.push(o);
  }

  const departments = Array.from(deptMap.values()).sort((a, b) =>
    (a.division || a.ownerName).localeCompare(b.division || b.ownerName)
  );
  return NextResponse.json({ departments });
}
