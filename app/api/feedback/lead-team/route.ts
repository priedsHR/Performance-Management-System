import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActivePeriod } from "@/lib/feedback/service";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "LEAD")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = await getActivePeriod();
  if (!period) return NextResponse.json({ period: null, team: [] });

  // Find team members whose managerId points to this lead
  const teamProfiles = await prisma.feedbackProfile.findMany({
    where: { managerId: session.user.id, active: true },
    include: { user: { select: { id: true, name: true } } },
  });

  const team = await Promise.all(
    teamProfiles.map(async (profile) => {
      const userId = profile.userId;

      // Check if this member submitted their self-assessment
      const selfResponses = await prisma.feedbackResponse.findMany({
        where: { periodId: period.id, raterId: userId, rateeId: userId },
      });
      const selfSubmitted = selfResponses.length > 0 && selfResponses.every((r) => r.submitted);

      // Count unique raters and how many have submitted
      const allResponses = await prisma.feedbackResponse.findMany({
        where: { periodId: period.id, rateeId: userId },
        select: { raterId: true, submitted: true },
      });
      const raterMap = new Map<string, boolean>();
      for (const r of allResponses) {
        if (!raterMap.has(r.raterId)) raterMap.set(r.raterId, r.submitted);
        else if (!r.submitted) raterMap.set(r.raterId, false);
      }
      const raterCount = raterMap.size;
      const raterSubmitted = [...raterMap.values()].filter(Boolean).length;

      return {
        userId,
        name: profile.user.name,
        position: profile.position,
        department: profile.department,
        selfSubmitted,
        raterCount,
        raterSubmitted,
      };
    })
  );

  return NextResponse.json({ period: { id: period.id, name: period.name }, team });
}
