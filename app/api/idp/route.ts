import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const FIELDS = [
  "careerAspiration", "coreStrength",
  "technicalFocus", "technicalAction", "technicalMetric",
  "behavioralFocus", "behavioralAction", "behavioralMetric",
  "learningFocus", "learningAction", "learningMetric",
  "impactProject",
] as const;

async function resolvePeriod(periodId?: string | null) {
  if (periodId) return prisma.feedbackPeriod.findUnique({ where: { id: periodId } });
  return (
    (await prisma.feedbackPeriod.findFirst({ where: { isActive: true } })) ??
    (await prisma.feedbackPeriod.findFirst({ orderBy: [{ year: "desc" }, { half: "desc" }] }))
  );
}

// GET ?periodId=       → own plan (creates nothing; returns null fields if absent)
// GET ?list=1&periodId → ADMIN: all plans; LEAD: plans of direct reports (360 org chart)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const period = await resolvePeriod(url.searchParams.get("periodId"));
  if (!period) return NextResponse.json({ period: null, plan: null });

  if (url.searchParams.get("list") === "1") {
    const role = session.user.role;
    if (role !== "ADMIN" && role !== "LEAD")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const where =
      role === "ADMIN"
        ? { periodId: period.id }
        : { periodId: period.id, user: { feedbackProfile: { managerId: session.user.id } } };
    const plans = await prisma.idpPlan.findMany({
      where,
      include: { user: { select: { id: true, name: true, division: true, feedbackProfile: { select: { position: true } } } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      period: { id: period.id, name: period.name },
      plans: plans.map((p) => ({
        ...p,
        userName: p.user.name,
        position: p.user.feedbackProfile?.position ?? null,
        division: p.user.division,
        user: undefined,
      })),
    });
  }

  const plan = await prisma.idpPlan.findUnique({
    where: { userId_periodId: { userId: session.user.id, periodId: period.id } },
  });
  return NextResponse.json({ period: { id: period.id, name: period.name }, plan });
}

// POST { periodId, submit?, ...fields } → upsert own plan
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const period = await resolvePeriod(body.periodId);
  if (!period) return NextResponse.json({ error: "No period available yet." }, { status: 400 });

  const data: Record<string, string> = {};
  for (const f of FIELDS) data[f] = String(body[f] ?? "").trim();

  if (body.submit) {
    // Leads submit a self-growth plan (behavioral row) instead of a technical one.
    const isLead = session.user.role === "LEAD";
    const required = isLead
      ? ["careerAspiration", "coreStrength", "behavioralFocus", "behavioralAction", "behavioralMetric"]
      : ["careerAspiration", "coreStrength", "technicalFocus", "technicalAction", "technicalMetric"];
    const missing = required.filter((f) => !data[f]);
    if (missing.length)
      return NextResponse.json(
        {
          error: isLead
            ? "Please fill in at least the Career Aspiration, Core Strength and the Behavioral row before submitting."
            : "Please fill in at least the Career Aspiration, Core Strength and the Technical row before submitting.",
        },
        { status: 400 }
      );
  }

  const plan = await prisma.idpPlan.upsert({
    where: { userId_periodId: { userId: session.user.id, periodId: period.id } },
    update: { ...data, status: body.submit ? "SUBMITTED" : undefined },
    create: { userId: session.user.id, periodId: period.id, ...data, status: body.submit ? "SUBMITTED" : "DRAFT" },
  });
  return NextResponse.json({ plan });
}

// PUT { userId, periodId, leadNote } → lead/admin coaching note
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "LEAD"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId, periodId, leadNote } = await req.json();
  if (!userId || !periodId) return NextResponse.json({ error: "userId and periodId are required." }, { status: 400 });

  if (session.user.role === "LEAD") {
    const profile = await prisma.feedbackProfile.findUnique({ where: { userId } });
    if (profile?.managerId !== session.user.id)
      return NextResponse.json({ error: "Not your direct report." }, { status: 403 });
  }
  const plan = await prisma.idpPlan.update({
    where: { userId_periodId: { userId, periodId } },
    data: { leadNote: String(leadNote ?? "") },
  });
  return NextResponse.json({ plan });
}
