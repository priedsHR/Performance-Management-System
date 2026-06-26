import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ensureFeedbackBootstrap, getFeedbackSettings } from "@/lib/feedback/service";

async function setProfileCompetencies(profileId: string, competencyIds: string[]) {
  await prisma.profileCompetency.deleteMany({ where: { profileId } });
  if (competencyIds.length) {
    await prisma.profileCompetency.createMany({
      data: competencyIds.map((competencyId) => ({ profileId, competencyId })),
      skipDuplicates: true,
    });
  }
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureFeedbackBootstrap();
  const profiles = await prisma.feedbackProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      manager: { select: { id: true, name: true } },
      competencies: { select: { competencyId: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return NextResponse.json(
    profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      role: p.user.role,
      department: p.department,
      position: p.position,
      level: p.level,
      targetLevel: p.targetLevel,
      isManager: p.isManager,
      managerId: p.managerId,
      managerName: p.manager?.name ?? null,
      active: p.active,
      competencyIds: p.competencies.map((c) => c.competencyId),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureFeedbackBootstrap();
  const settings = await getFeedbackSettings();
  const body = await req.json();

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!name || !email.includes("@"))
    return NextResponse.json({ error: "Nama dan email valid wajib diisi." }, { status: 400 });

  const level = body.level || null;
  let targetLevel: number | null;
  if (body.targetLevel === null) targetLevel = null;
  else if (body.targetLevel != null) targetLevel = Number(body.targetLevel);
  else if (level) targetLevel = settings.levelTargets[level] ?? null;
  else targetLevel = null;

  // Find or create the login user.
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const password = String(body.password || "").trim();
    if (!password)
      return NextResponse.json({ error: "Password wajib untuk pengguna baru." }, { status: 400 });
    user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 10),
        role: body.role === "ADMIN" || body.role === "LEAD" ? body.role : "MEMBER",
        division: body.department ?? null,
      },
    });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { name } });
  }

  const existing = await prisma.feedbackProfile.findUnique({ where: { userId: user.id } });
  if (existing)
    return NextResponse.json({ error: "Karyawan ini sudah punya profil 360." }, { status: 400 });

  const profile = await prisma.feedbackProfile.create({
    data: {
      userId: user.id,
      department: body.department || null,
      position: body.position || null,
      level,
      targetLevel,
      isManager: body.role === "LEAD" || body.role === "ADMIN",
      managerId: body.managerId || null,
      active: body.active !== false,
    },
  });
  await setProfileCompetencies(profile.id, Array.isArray(body.competencyIds) ? body.competencyIds : []);

  return NextResponse.json({ id: profile.id, userId: user.id }, { status: 201 });
}
