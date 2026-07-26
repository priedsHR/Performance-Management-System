import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAssignmentsFor, loadPeerExclusions, loadProfilesLite } from "@/lib/feedback/service";

// Per-employee submission status for a period: how many of their assigned
// assessments they've submitted, and whether they're fully done.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const periodId = new URL(req.url).searchParams.get("periodId");
  if (!periodId) return NextResponse.json({ error: "periodId is required." }, { status: 400 });

  const profiles = (await loadProfilesLite()).filter((p) => p.active);
  const manualPeers = await prisma.feedbackManualPeer.findMany({ where: { OR: [{ periodId: null }, { periodId }] } });
  const manualByRater = new Map<string, string[]>();
  for (const mp of manualPeers) manualByRater.set(mp.raterId, [...(manualByRater.get(mp.raterId) ?? []), mp.rateeId]);
  const excluded = await loadPeerExclusions();

  const submitted = await prisma.feedbackResponse.findMany({
    where: { periodId, submitted: true },
    select: { raterId: true, rateeId: true },
  });
  const submittedPairs = new Set(submitted.map((r) => `${r.raterId}:${r.rateeId}`));

  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.userId) } },
    select: { id: true, name: true, feedbackProfile: { select: { department: true, position: true } } },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const rows = profiles.map((p) => {
    const assignments = computeAssignmentsFor(p.userId, profiles, manualByRater.get(p.userId) ?? [], excluded);
    const assigned = assignments.length;
    const done = assignments.filter((a) => submittedPairs.has(`${p.userId}:${a.ratee.userId}`)).length;
    const u = userById.get(p.userId);
    return {
      userId: p.userId,
      name: u?.name ?? "",
      department: u?.feedbackProfile?.department ?? null,
      position: u?.feedbackProfile?.position ?? null,
      assigned,
      done,
      complete: assigned > 0 && done >= assigned,
    };
  }).sort((a, b) => Number(a.complete) - Number(b.complete) || a.name.localeCompare(b.name));

  const completed = rows.filter((r) => r.complete).length;
  return NextResponse.json({ rows, completed, total: rows.length });
}
