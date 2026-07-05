import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAssignmentsFor,
  loadPeerExclusions,
  loadProfilesLite,
} from "@/lib/feedback/service";

// Admin editor for one employee's effective peer list.
// GET  ?userId=x → candidates with current peer status
// POST { userId, peerIds } → make the effective peer list exactly peerIds
//   (dept peers unticked become exclusions; non-dept ticked become manual pairs)

async function candidatesFor(userId: string) {
  const profiles = (await loadProfilesLite()).filter((p) => p.active);
  const me = profiles.find((p) => p.userId === userId);
  if (!me) return null;

  const manualPeers = await prisma.feedbackManualPeer.findMany({
    where: { raterId: userId, periodId: null },
    select: { rateeId: true },
  });
  const excluded = await loadPeerExclusions();
  const assignments = computeAssignmentsFor(userId, profiles, manualPeers.map((m) => m.rateeId), excluded);
  const peerNow = new Set(assignments.filter((a) => a.relation === "PEER").map((a) => a.ratee.userId));

  const directReports = new Set(profiles.filter((p) => p.managerId === userId).map((p) => p.userId));
  const list = profiles
    .filter((p) => p.userId !== userId && p.userId !== me.managerId && !directReports.has(p.userId))
    .map((p) => ({
      userId: p.userId,
      name: p.name,
      department: p.department,
      position: p.position,
      isDeptDefault: !!(me.department && p.department && me.department === p.department),
      isPeer: peerNow.has(p.userId),
    }))
    .sort((a, b) => Number(b.isDeptDefault) - Number(a.isDeptDefault) || a.name.localeCompare(b.name));
  return { me, list };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = new URL(req.url).searchParams.get("userId") || "";
  const data = await candidatesFor(userId);
  if (!data) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  return NextResponse.json({ candidates: data.list });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId, peerIds }: { userId: string; peerIds: string[] } = await req.json();
  if (!userId || !Array.isArray(peerIds))
    return NextResponse.json({ error: "userId and peerIds are required." }, { status: 400 });

  const data = await candidatesFor(userId);
  if (!data) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const want = new Set(peerIds);

  for (const c of data.list) {
    const [a, b] = [userId, c.userId].sort();
    if (c.isDeptDefault) {
      if (want.has(c.userId)) {
        await prisma.feedbackPeerExclusion.deleteMany({ where: { userAId: a, userBId: b } });
      } else {
        await prisma.feedbackPeerExclusion.upsert({
          where: { userAId_userBId: { userAId: a, userBId: b } },
          update: {},
          create: { userAId: a, userBId: b },
        });
      }
    } else {
      if (want.has(c.userId)) {
        await prisma.feedbackManualPeer.createMany({
          data: [
            { raterId: userId, rateeId: c.userId, periodId: null },
            { raterId: c.userId, rateeId: userId, periodId: null },
          ],
          skipDuplicates: true,
        });
      } else {
        await prisma.feedbackManualPeer.deleteMany({
          where: {
            periodId: null,
            OR: [
              { raterId: userId, rateeId: c.userId },
              { raterId: c.userId, rateeId: userId },
            ],
          },
        });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
