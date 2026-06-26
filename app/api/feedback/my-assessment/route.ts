import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAssignmentsFor,
  ensureFeedbackBootstrap,
  getActivePeriod,
  loadProfilesLite,
} from "@/lib/feedback/service";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackBootstrap();

  const period = await getActivePeriod();
  if (!period) return NextResponse.json({ period: null, tasks: [] });

  const [profiles, manualPeers] = await Promise.all([
    loadProfilesLite(),
    prisma.feedbackManualPeer.findMany({
      where: { raterId: session.user.id, OR: [{ periodId: period.id }, { periodId: null }] },
      select: { rateeId: true },
    }),
  ]);
  const manualPeerRateeIds = manualPeers.map((p) => p.rateeId);
  const assignments = computeAssignmentsFor(session.user.id, profiles, manualPeerRateeIds);

  const comps = await prisma.competency.findMany();
  const compMap = new Map(comps.map((c) => [c.id, c]));

  const existing = await prisma.feedbackResponse.findMany({
    where: { periodId: period.id, raterId: session.user.id },
  });
  const exMap = new Map(existing.map((r) => [`${r.rateeId}:${r.competencyId}`, r]));

  const existingComments = await prisma.feedbackComment.findMany({
    where: { periodId: period.id, raterId: session.user.id },
  });
  const cmMap = new Map(existingComments.map((c) => [`${c.rateeId}:${c.category}`, c.comment]));

  const tasks = assignments.map(({ ratee, relation }) => {
    const competencies = ratee.competencyIds
      .map((cid) => compMap.get(cid))
      .filter((c): c is NonNullable<typeof c> => !!c && c.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => {
        const prev = exMap.get(`${ratee.userId}:${c.id}`);
        return {
          id: c.id,
          code: c.code,
          name: c.name,
          category: c.category,
          definition: c.definition,
          levels: [c.l1, c.l2, c.l3, c.l4],
          score: prev?.score ?? null,
        };
      });
    const cats = [...new Set(competencies.map((c) => c.category))];
    const comments: Record<string, string> = {};
    for (const cat of cats) comments[cat] = cmMap.get(`${ratee.userId}:${cat}`) ?? "";
    const answered = competencies.filter((c) => c.score != null).length;
    const submitted =
      competencies.length > 0 &&
      competencies.every((c) => exMap.get(`${ratee.userId}:${c.id}`)?.submitted);
    return {
      rateeUserId: ratee.userId,
      rateeName: ratee.name,
      position: ratee.position,
      department: ratee.department,
      targetLevel: ratee.targetLevel,
      relation,
      competencies,
      comments,
      answered,
      total: competencies.length,
      submitted,
    };
  });

  return NextResponse.json({ period: { id: period.id, name: period.name }, tasks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await getActivePeriod();
  if (!period) return NextResponse.json({ error: "Belum ada periode aktif." }, { status: 400 });

  const body = await req.json();
  const rateeUserId = String(body.rateeUserId || "");
  const scores: Record<string, number> = body.scores || {};
  const comments: Record<string, string> = body.comments || {};
  const submit = !!body.submit;

  // Verify the rater is actually assigned to this ratee, and find the relation.
  const [profiles, manualPeersPost] = await Promise.all([
    loadProfilesLite(),
    prisma.feedbackManualPeer.findMany({
      where: { raterId: session.user.id, OR: [{ periodId: period.id }, { periodId: null }] },
      select: { rateeId: true },
    }),
  ]);
  const assignments = computeAssignmentsFor(session.user.id, profiles, manualPeersPost.map((p) => p.rateeId));
  const assignment = assignments.find((a) => a.ratee.userId === rateeUserId);
  if (!assignment)
    return NextResponse.json({ error: "Kamu tidak ditugaskan menilai orang ini." }, { status: 403 });

  const allowed = new Set(assignment.ratee.competencyIds);

  for (const [competencyId, raw] of Object.entries(scores)) {
    if (!allowed.has(competencyId)) continue;
    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 4) continue;
    await prisma.feedbackResponse.upsert({
      where: {
        periodId_raterId_rateeId_competencyId: {
          periodId: period.id,
          raterId: session.user.id,
          rateeId: rateeUserId,
          competencyId,
        },
      },
      create: {
        periodId: period.id,
        raterId: session.user.id,
        rateeId: rateeUserId,
        competencyId,
        relation: assignment.relation,
        score,
        submitted: submit,
      },
      update: { score, relation: assignment.relation, submitted: submit ? true : undefined },
    });
  }

  const VALID_CATS = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];
  for (const [category, raw] of Object.entries(comments)) {
    if (!VALID_CATS.includes(category)) continue;
    const text = String(raw ?? "").trim();
    const existing = await prisma.feedbackComment.findUnique({
      where: {
        periodId_raterId_rateeId_category: {
          periodId: period.id,
          raterId: session.user.id,
          rateeId: rateeUserId,
          category,
        },
      },
    });
    if (!text) {
      if (existing) await prisma.feedbackComment.delete({ where: { id: existing.id } });
      continue;
    }
    await prisma.feedbackComment.upsert({
      where: {
        periodId_raterId_rateeId_category: {
          periodId: period.id,
          raterId: session.user.id,
          rateeId: rateeUserId,
          category,
        },
      },
      create: {
        periodId: period.id,
        raterId: session.user.id,
        rateeId: rateeUserId,
        category,
        comment: text,
        submitted: submit,
      },
      update: { comment: text, submitted: submit ? true : undefined },
    });
  }

  if (submit) {
    // mark all of this rater's responses for this ratee as submitted
    await prisma.feedbackResponse.updateMany({
      where: { periodId: period.id, raterId: session.user.id, rateeId: rateeUserId },
      data: { submitted: true },
    });
    await prisma.feedbackComment.updateMany({
      where: { periodId: period.id, raterId: session.user.id, rateeId: rateeUserId },
      data: { submitted: true },
    });
  }

  return NextResponse.json({ ok: true });
}
