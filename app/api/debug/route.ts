import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Temporary: POST to force-set a teamMember link
export async function POST(req: Request) {
  try {
    const session = await (await import("@/auth")).auth();
    if (session?.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });
    const { userId, teamMemberId } = await req.json();
    const existing = await prisma.teamMember.findUnique({ where: { userId } });
    if (existing) await prisma.teamMember.update({ where: { id: existing.id }, data: { userId: null } });
    const result = await prisma.teamMember.update({ where: { id: teamMemberId }, data: { userId } });
    return Response.json({ ok: true, linked: result.name });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// Admin shortcut: /api/debug?link=userId,teamMemberId
export async function GET(req: Request) {
  const url = new URL(req.url);
  const linkParam = url.searchParams.get("link");
  try {
    const session = await auth();

    // Force-link shortcut for admin
    if (linkParam && session?.user.role === "ADMIN") {
      const [userId, teamMemberId] = linkParam.split(",");
      const existing = await prisma.teamMember.findUnique({ where: { userId } });
      if (existing) await prisma.teamMember.update({ where: { id: existing.id }, data: { userId: null } });
      const result = await prisma.teamMember.update({ where: { id: teamMemberId }, data: { userId } });
      return Response.json({ ok: true, action: "linked", member: result.name, userId, teamMemberId });
    }

    const userCount = await prisma.user.count();

    // Member link debug info
    let memberDebug = null;
    if (session?.user?.id) {
      const userId = session.user.id;
      const teamMember = await prisma.teamMember.findUnique({
        where: { userId },
        include: { lead: { select: { name: true, division: true } } },
      });
      const allMembers = await prisma.user.findMany({
        where: { role: "MEMBER" },
        select: { id: true, name: true, teamMembership: { select: { id: true, name: true } } },
      });
      const allTeamMembers = await prisma.teamMember.findMany({
        select: { id: true, name: true, userId: true, lead: { select: { name: true, division: true } } },
        orderBy: { name: "asc" },
      });
      const activeQuarter = await prisma.quarter.findFirst({ where: { isActive: true }, select: { id: true, name: true } });
      const assignmentCount = teamMember && activeQuarter
        ? await prisma.objectiveAssignment.count({ where: { memberId: teamMember.id, objective: { quarterId: activeQuarter.id } } })
        : null;

      memberDebug = {
        sessionUserId: userId,
        sessionRole: session.user.role,
        linkedTeamMember: teamMember ? { id: teamMember.id, name: teamMember.name, lead: teamMember.lead } : null,
        activeQuarter,
        assignmentsInActiveQuarter: assignmentCount,
        allMemberLinks: allMembers.map(u => ({ userId: u.id, name: u.name, linked: u.teamMembership?.name ?? null })),
        allTeamMembers,
      };
    }

    return Response.json({
      ok: true,
      userCount,
      session: session ? { id: session.user.id, email: session.user.email, role: session.user.role } : null,
      memberDebug,
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
