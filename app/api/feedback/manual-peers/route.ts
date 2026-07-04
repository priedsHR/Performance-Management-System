import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/feedback/manual-peers?periodId=... → list all pairs with direction info
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get("periodId") || null;

  const pairs = await prisma.feedbackManualPeer.findMany({
    where: { periodId },
    include: {
      rater: { select: { id: true, name: true } },
      ratee: { select: { id: true, name: true } },
    },
    orderBy: [{ rater: { name: "asc" } }, { ratee: { name: "asc" } }],
  });

  // Group by canonical key to detect bidirectional vs directional
  const groups = new Map<string, typeof pairs>();
  for (const p of pairs) {
    const key = [p.raterId, p.rateeId].sort().join(":");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const result = [];
  for (const [, entries] of groups) {
    const first = entries[0];
    const isBidirectional = entries.length >= 2;
    // For bidirectional, pick the entry where raterId < rateeId for stable ordering
    const display = isBidirectional
      ? entries.find((e) => e.raterId < e.rateeId) ?? first
      : first;

    result.push({
      id: display.id,
      raterId: display.raterId,
      raterName: display.rater.name,
      rateeId: display.rateeId,
      rateeName: display.ratee.name,
      periodId: display.periodId,
      isPeer: isBidirectional, // true = bidirectional peer, false = directional (rater→ratee only)
    });
  }

  return NextResponse.json(result);
}

// POST /api/feedback/manual-peers → add a peer pair or directional assignment
// body: { userAId, userBId, periodId?, type: "peer" | "a_rates_b" | "b_rates_a" }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userAId, userBId, periodId, type = "peer" } = body;
  if (!userAId || !userBId || userAId === userBId)
    return NextResponse.json({ error: "Choose two different employees." }, { status: 400 });

  if (type === "peer") {
    // Bidirectional
    await prisma.feedbackManualPeer.createMany({
      data: [
        { raterId: userAId, rateeId: userBId, periodId: periodId || null },
        { raterId: userBId, rateeId: userAId, periodId: periodId || null },
      ],
      skipDuplicates: true,
    });
  } else if (type === "a_rates_b") {
    // A (superordinate/atasan) rates B (subordinate/bawahan)
    await prisma.feedbackManualPeer.createMany({
      data: [{ raterId: userAId, rateeId: userBId, periodId: periodId || null }],
      skipDuplicates: true,
    });
  } else if (type === "b_rates_a") {
    // B (superordinate/atasan) rates A (subordinate/bawahan)
    await prisma.feedbackManualPeer.createMany({
      data: [{ raterId: userBId, rateeId: userAId, periodId: periodId || null }],
      skipDuplicates: true,
    });
  } else {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/feedback/manual-peers → remove a pair
// body: { userAId, userBId, periodId? } — always removes all directions for this pair
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userAId, userBId, periodId } = body;

  await prisma.feedbackManualPeer.deleteMany({
    where: {
      OR: [
        { raterId: userAId, rateeId: userBId, periodId: periodId || null },
        { raterId: userBId, rateeId: userAId, periodId: periodId || null },
      ],
    },
  });

  return NextResponse.json({ ok: true });
}
