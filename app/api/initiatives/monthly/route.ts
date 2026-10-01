import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Owner of the objective behind this initiative, or admin.
async function ownsInitiative(initiativeId: string, userId: string, isAdmin: boolean) {
  const init = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    include: { keyResult: { include: { objective: { select: { userId: true } } } } },
  });
  if (!init) return { ok: false as const, status: 404, error: "Initiative not found." };
  if (!isAdmin && init.keyResult.objective.userId !== userId)
    return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

// Set one month's actual for an initiative. The initiative's `actual` is then
// synced to the latest (year, month) that has a value, so all existing
// achievement roll-ups stay correct.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const initiativeId = String(body.initiativeId || "");
  const year = Number(body.year);
  const month = Number(body.month);
  const actual = Number(body.actual);
  if (!initiativeId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12)
    return NextResponse.json({ error: "initiativeId, year and month (1–12) are required." }, { status: 400 });

  const own = await ownsInitiative(initiativeId, session.user.id, session.user.role === "ADMIN");
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  await prisma.initiativeMonthly.upsert({
    where: { initiativeId_year_month: { initiativeId, year, month } },
    create: { initiativeId, year, month, actual: Number.isFinite(actual) ? actual : 0 },
    update: { actual: Number.isFinite(actual) ? actual : 0 },
  });

  // Sync Initiative.actual to the latest month that has an entry.
  const latest = await prisma.initiativeMonthly.findFirst({
    where: { initiativeId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { actual: true },
  });
  const updated = await prisma.initiative.update({
    where: { id: initiativeId },
    data: { actual: latest?.actual ?? 0 },
    include: { monthly: { orderBy: [{ year: "asc" }, { month: "asc" }] }, pic: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}
