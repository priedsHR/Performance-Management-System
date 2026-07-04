import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getFeedbackSettings } from "@/lib/feedback/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const settings = await getFeedbackSettings();

  const profile = await prisma.feedbackProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.department !== undefined) data.department = body.department || null;
  if (body.position !== undefined) data.position = body.position || null;
  if (body.level !== undefined) {
    data.level = body.level || null;
    if (body.targetLevel === undefined && body.level)
      data.targetLevel = settings.levelTargets[body.level] ?? profile.targetLevel;
  }
  if (body.targetLevel !== undefined) data.targetLevel = body.targetLevel === null ? null : Number(body.targetLevel);
  if (body.role && ["ADMIN", "LEAD", "MEMBER"].includes(body.role))
    data.isManager = body.role === "LEAD" || body.role === "ADMIN";
  if (body.managerId !== undefined) data.managerId = body.managerId || null;
  if (body.active !== undefined) data.active = !!body.active;

  await prisma.feedbackProfile.update({ where: { id }, data });

  // user fields
  const userData: Record<string, unknown> = {};
  if (body.name) userData.name = body.name;
  if (body.role && ["ADMIN", "LEAD", "MEMBER"].includes(body.role)) userData.role = body.role;
  if (body.password) userData.password = await bcrypt.hash(String(body.password), 10);
  if (Object.keys(userData).length)
    await prisma.user.update({ where: { id: profile.userId }, data: userData });

  if (Array.isArray(body.competencyIds)) {
    await prisma.profileCompetency.deleteMany({ where: { profileId: id } });
    await prisma.profileCompetency.createMany({
      data: body.competencyIds.map((competencyId: string) => ({ profileId: id, competencyId })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const url = new URL(req.url);
  const profile = await prisma.feedbackProfile.findUnique({ where: { id } });
  if (!profile) return new NextResponse(null, { status: 204 });

  // Default: remove only the 360 profile. ?withUser=1 also deletes the login account.
  await prisma.feedbackProfile.delete({ where: { id } });
  if (url.searchParams.get("withUser") === "1") {
    await prisma.user.delete({ where: { id: profile.userId } }).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
