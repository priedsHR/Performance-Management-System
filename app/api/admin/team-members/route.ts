import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await prisma.teamMember.findMany({
    select: { id: true, name: true, leadId: true, userId: true, lead: { select: { division: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}
