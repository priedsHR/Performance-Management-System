import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAssignmentsFor, loadProfilesLite } from "@/lib/feedback/service";

const DEMO_EMAIL_SUFFIX = "@demo360.local";

// Admin-only trial tools: fill the period with random submitted responses, or
// wipe all answers so the forms are clean and ready to send to employees.
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, periodId }: { action: "fill" | "reset"; periodId: string } = await req.json();
  if (!action || !periodId)
    return NextResponse.json({ error: "action and periodId are required." }, { status: 400 });

  const period = await prisma.feedbackPeriod.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Period not found." }, { status: 404 });

  if (action === "reset") {
    const resp = await prisma.feedbackResponse.deleteMany({ where: { periodId } });
    const com = await prisma.feedbackComment.deleteMany({ where: { periodId } });
    // also remove demo employees created by the simulator script, if any
    const demo = await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL_SUFFIX } } });
    return NextResponse.json({
      message: `Reset done: ${resp.count} answers and ${com.count} notes cleared${demo.count ? `, ${demo.count} demo employees removed` : ""}. Forms are ready to send to employees.`,
    });
  }

  // action === "fill"
  const profiles = (await loadProfilesLite()).filter((p) => p.active);
  if (profiles.length < 2)
    return NextResponse.json({ error: "Add at least 2 active employees first (Employee Data menu)." }, { status: 400 });

  const manualPeers = await prisma.feedbackManualPeer.findMany({
    where: { OR: [{ periodId: null }, { periodId }] },
  });
  const manualByRater = new Map<string, string[]>();
  for (const mp of manualPeers) {
    manualByRater.set(mp.raterId, [...(manualByRater.get(mp.raterId) ?? []), mp.rateeId]);
  }

  const compIdsByUser = new Map(profiles.map((p) => [p.userId, p.competencyIds]));
  const rows: {
    periodId: string; raterId: string; rateeId: string; competencyId: string;
    relation: string; score: number; submitted: boolean;
  }[] = [];

  for (const rater of profiles) {
    const assignments = computeAssignmentsFor(rater.userId, profiles, manualByRater.get(rater.userId) ?? []);
    for (const { ratee, relation } of assignments) {
      const target = ratee.targetLevel ?? 2;
      for (const competencyId of compIdsByUser.get(ratee.userId) ?? []) {
        // random score around the ratee's target, clamped 1..4 (same as the prototype)
        const score = Math.max(1, Math.min(4, Math.round(target + (Math.random() < 0.5 ? 0 : 1) - (Math.random() < 0.3 ? 1 : 0))));
        rows.push({ periodId, raterId: rater.userId, rateeId: ratee.userId, competencyId, relation, score, submitted: true });
      }
    }
  }

  // keep any answers already given; only add the missing ones
  const created = await prisma.feedbackResponse.createMany({ data: rows, skipDuplicates: true });
  await prisma.feedbackResponse.updateMany({ where: { periodId }, data: { submitted: true } });

  // sample qualitative feedback per rater/ratee/category, so reports show the
  // "what raters said" summary during trials
  const SAMPLES: Record<string, string[]> = {
    CORE: [
      "Shows strong ownership of daily tasks and responds quickly when problems come up; could speak up earlier when priorities clash.",
      "Reliable team player who shares information openly. To reach the next level, take more initiative on improvements instead of waiting for direction.",
      "Consistently meets commitments and stays calm under pressure. Should push quality further by double-checking edge cases before handover.",
    ],
    LEADERSHIP: [
      "Gives the team clear direction and useful feedback; could delegate more and build a stronger successor plan.",
      "Handles change well and keeps people motivated. Needs to make tougher calls faster when the team is stuck.",
    ],
    JOB_FAMILY: [
      "Solid analytical approach to day-to-day cases; should go deeper on root-cause analysis for complex, unfamiliar problems.",
      "Good grasp of the craft and dependable output. Invest in anticipating issues one step ahead rather than reacting.",
    ],
    TECHNICAL: [
      "Technically dependable on routine work; the next step is handling complex cases independently and sharing knowledge with the team.",
      "Uses the tools well and delivers on time. Recommend exploring more advanced techniques (including AI tooling) to raise efficiency.",
    ],
  };
  const compCatById = new Map(
    (await prisma.competency.findMany({ select: { id: true, category: true } })).map((c) => [c.id, c.category])
  );
  const commentRows: { periodId: string; raterId: string; rateeId: string; category: string; comment: string; submitted: boolean }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.relation === "SELF") continue;
    const cat = compCatById.get(r.competencyId);
    if (!cat) continue;
    const key = `${r.raterId}:${r.rateeId}:${cat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pool = SAMPLES[cat] ?? SAMPLES.CORE;
    commentRows.push({
      periodId, raterId: r.raterId, rateeId: r.rateeId, category: cat,
      comment: pool[Math.floor(Math.random() * pool.length)], submitted: true,
    });
  }
  await prisma.feedbackComment.createMany({ data: commentRows, skipDuplicates: true });

  return NextResponse.json({
    message: `Simulation done: ${created.count} answers filled for ${profiles.length} employees in ${period.name}.`,
  });
}
