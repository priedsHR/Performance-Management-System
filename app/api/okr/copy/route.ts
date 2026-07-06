import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/okr/copy
// Copy selected objectives + specific key results from one quarter to another
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fromQuarterId, toQuarterId, selections } = body;

  if (!fromQuarterId || !toQuarterId) {
    return NextResponse.json({ error: "fromQuarterId dan toQuarterId diperlukan" }, { status: 400 });
  }

  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    return NextResponse.json({ error: "Select at least one objective to import" }, { status: 400 });
  }

  // Fetch all source objectives for this user in the source quarter
  const objectiveIds = selections.map((s: { objectiveId: string }) => s.objectiveId);
  const sourceObjs = await prisma.objective.findMany({
    where: {
      id: { in: objectiveIds },
      quarterId: fromQuarterId,
      userId: session.user.id,
    },
    include: { keyResults: true },
  });

  if (sourceObjs.length === 0) {
    return NextResponse.json({ error: "Tidak ada objective yang bisa diimpor" }, { status: 404 });
  }

  // Build a map of objectiveId → selected keyResultIds
  const krMap: Record<string, string[]> = {};
  for (const sel of selections as { objectiveId: string; keyResultIds: string[] }[]) {
    krMap[sel.objectiveId] = sel.keyResultIds ?? [];
  }

  // Create objectives + filtered key results in the target quarter
  const created = await Promise.all(
    sourceObjs.map((obj) => {
      const allowedKRIds = new Set(krMap[obj.id] ?? []);
      const krsToCreate = obj.keyResults.filter((kr) =>
        allowedKRIds.size === 0 ? true : allowedKRIds.has(kr.id)
      );

      return prisma.objective.create({
        data: {
          title: obj.title,
          weight: obj.weight,
          status: "DRAFT",
          userId: session.user.id,
          quarterId: toQuarterId,
          keyResults: {
            create: krsToCreate.map((kr) => ({
              title: kr.title,
              target: kr.target,
              unit: kr.unit,
              weight: kr.weight,
              teamProgress: 0,
              leadProgress: null,
            })),
          },
        },
        include: { keyResults: true },
      });
    })
  );

  return NextResponse.json(created, { status: 201 });
}
