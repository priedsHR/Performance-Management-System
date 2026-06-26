import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leadId = session.user.role === "ADMIN" ? undefined : session.user.id;
  const members = await prisma.teamMember.findMany({
    where: leadId ? { leadId } : {},
    include: {
      assignments: { include: { objective: { select: { id: true, title: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const member = await prisma.teamMember.create({
    data: { name: body.name, leadId: session.user.id },
    include: { assignments: true },
  });
  return NextResponse.json(member, { status: 201 });
}
