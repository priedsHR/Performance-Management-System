import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeedbackBootstrap, getActivePeriod, getFeedbackSettings, bandFor } from "@/lib/feedback/service";
import { scoreRatee } from "@/lib/feedback/scoring";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackBootstrap();

  const url = new URL(req.url);
  const settings = await getFeedbackSettings();
  const isAdmin = session.user.role === "ADMIN";

  // ---- Trend view (a person's overall + per-category across periods) ----
  if (url.searchParams.get("trend") === "1") {
    const userId = url.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
    const profile = await prisma.feedbackProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const isSelf = session.user.id === userId;
    const isManager = profile.managerId === session.user.id;
    if (!isAdmin && !isManager && !isSelf)
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });

    const periods = await prisma.feedbackPeriod.findMany({ orderBy: [{ year: "asc" }, { half: "asc" }] });
    const series: {
      periodId: string;
      name: string;
      year: number;
      half: string;
      overall: number | null;
      categories: Record<string, number | null>;
    }[] = [];
    for (const p of periods) {
      // self can only see released periods in the trend
      if (isSelf && !isAdmin && !isManager && !p.releaseReports) continue;
      const r = await scoreRatee(userId, p.id, settings);
      if (!r.hasData) continue;
      const categories: Record<string, number | null> = {};
      for (const c of r.categories) categories[c.category] = c.score;
      series.push({ periodId: p.id, name: p.name, year: p.year, half: p.half, overall: r.overall, categories });
    }
    return NextResponse.json({ person: { name: profile.user.name }, series });
  }

  const periodId = url.searchParams.get("periodId") || (await getActivePeriod())?.id;
  if (!periodId) return NextResponse.json({ error: "No periods yet." }, { status: 400 });
  const period = await prisma.feedbackPeriod.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Period not found." }, { status: 404 });

  // ---- Admin list view ----
  if (url.searchParams.get("all") === "1") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const profiles = await prisma.feedbackProfile.findMany({
      where: { active: true },
      include: { user: { select: { id: true, name: true } } },
    });
    const rows: {
      userId: string;
      name: string;
      department: string | null;
      position: string | null;
      targetLevel: number | null;
      overall: number | null;
      band: { key: string; label: string; color: string };
      responseCount: number;
      hasData: boolean;
    }[] = [];
    for (const p of profiles) {
      const r = await scoreRatee(p.userId, periodId, settings);
      rows.push({
        userId: p.userId,
        name: p.user.name,
        department: p.department,
        position: p.position,
        targetLevel: p.targetLevel,
        overall: r.overall,
        band: bandFor(r.overall, settings.bands),
        responseCount: r.responseCount,
        hasData: r.hasData,
      });
    }
    rows.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
    return NextResponse.json({ period, rows });
  }

  // ---- Single report view ----
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const profile = await prisma.feedbackProfile.findUnique({
    where: { userId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  // Access control: admin, the person themselves (if released), or their manager.
  const isSelf = session.user.id === userId;
  const isManager = profile.managerId === session.user.id;
  if (!isAdmin && !isManager && !(isSelf && period.releaseReports)) {
    return NextResponse.json({ error: "This report is not available to you yet." }, { status: 403 });
  }

  const report = await scoreRatee(userId, periodId, settings);

  // Qualitative comments — aggregated per category, rater identities removed,
  // but split into superordinate (the ratee's manager) vs everyone else.
  const rawComments = await prisma.feedbackComment.findMany({
    where: { rateeId: userId, periodId, submitted: true },
    select: { category: true, comment: true, raterId: true },
  });
  const comments: Record<string, string[]> = {};
  const commentsSuper: Record<string, string[]> = {};
  const commentsOthers: Record<string, string[]> = {};
  for (const c of rawComments) {
    (comments[c.category] ??= []).push(c.comment);
    if (profile.managerId && c.raterId === profile.managerId) {
      (commentsSuper[c.category] ??= []).push(c.comment);
    } else if (c.raterId !== userId) {
      (commentsOthers[c.category] ??= []).push(c.comment);
    }
  }

  return NextResponse.json({
    period: { id: period.id, name: period.name, releaseReports: period.releaseReports },
    person: {
      name: profile.user.name,
      position: profile.position,
      department: profile.department,
      level: profile.level,
      targetLevel: profile.targetLevel,
    },
    report, // rater identities are never included
    comments, // { CORE: ["...","..."], ... } anonymous
    commentsSuper, // from the superordinate only (still unattributed in UI)
    commentsOthers, // peers & subordinates (self excluded)
  });
}
