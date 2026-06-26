import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeedbackBootstrap, getFeedbackSettings } from "@/lib/feedback/service";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackBootstrap();
  const settings = await getFeedbackSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureFeedbackBootstrap();

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.weightSuper != null) data.weightSuper = Number(body.weightSuper);
  if (body.weightPeer != null) data.weightPeer = Number(body.weightPeer);
  if (body.weightSub != null) data.weightSub = Number(body.weightSub);
  if (Array.isArray(body.bands)) data.bands = body.bands;
  if (body.levelTargets && typeof body.levelTargets === "object") data.levelTargets = body.levelTargets;

  await prisma.feedbackSetting.update({ where: { id: "singleton" }, data });
  return NextResponse.json(await getFeedbackSettings());
}
