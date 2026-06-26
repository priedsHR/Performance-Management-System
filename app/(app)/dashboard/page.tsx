import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DivisionView from "./DivisionView";
import IndividualView from "./IndividualView";
import MemberDashboard from "./MemberDashboard";
import MemberView from "./MemberView";
import DashboardTabs from "./DashboardTabs";
import AdminOverview from "./AdminOverview";

// Find the quarter that actually has assignments for a lead; fall back to active → first
async function resolveDefaultQuarter(
  leadId: string,
  quarters: { id: string; isActive: boolean }[]
): Promise<string> {
  const latest = await prisma.objectiveAssignment.findFirst({
    where: { member: { leadId } },
    include: { objective: { select: { quarterId: true } } },
  });
  if (latest?.objective.quarterId) return latest.objective.quarterId;
  return quarters.find((q) => q.isActive)?.id ?? quarters[0]?.id ?? "";
}

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;

  const quarters = await prisma.quarter.findMany({
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
    select: { id: true, name: true, year: true, quarter: true, isActive: true },
  });

  /* ─── MEMBER ─── */
  if (role === "MEMBER") {
    const activeQuarter = quarters.find((q) => q.isActive) ?? quarters[0];
    const myLead = session!.user.division
      ? await prisma.user.findFirst({ where: { role: "LEAD", division: session!.user.division }, select: { id: true, division: true } })
      : null;

    return (
      <MemberView
        quarters={JSON.parse(JSON.stringify(quarters))}
        initialQuarterId={activeQuarter?.id ?? ""}
        leadId={myLead?.id ?? null}
        divisionName={myLead?.division ?? session!.user.division ?? null}
      />
    );
  }

  /* ─── LEAD ─── */
  if (role === "LEAD") {
    const members = await prisma.teamMember.findMany({
      where: { leadId: session!.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const defaultQuarterId = await resolveDefaultQuarter(session!.user.id, quarters);
    return (
      <DashboardTabs
        title={session!.user.division ?? "Divisi Saya"}
        quarters={JSON.parse(JSON.stringify(quarters))}
        members={JSON.parse(JSON.stringify(members))}
        leadId={session!.user.id}
        defaultQuarterId={defaultQuarterId}
      />
    );
  }

  /* ─── ADMIN ─── */
  const leads = await prisma.user.findMany({
    where: { role: "LEAD" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, division: true },
  });

  if (leads.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">📊 Dashboard Admin</h1>
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-slate-500 text-sm">Belum ada Lead Divisi. Tambahkan di Admin → Pengguna.</p>
        </div>
      </div>
    );
  }

  // Admin sees each division with its own tabs
  const allMembersByLead: Record<string, { id: string; name: string }[]> = {};
  for (const lead of leads) {
    const mems = await prisma.teamMember.findMany({
      where: { leadId: lead.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    allMembersByLead[lead.id] = mems;
  }

  const defaultQuarterByLead: Record<string, string> = {};
  for (const lead of leads) {
    defaultQuarterByLead[lead.id] = await resolveDefaultQuarter(lead.id, quarters);
  }

  const allMembersByLeadSerialized: Record<string, { id: string; name: string }[]> = {};
  for (const lead of leads) {
    allMembersByLeadSerialized[lead.id] = JSON.parse(JSON.stringify(allMembersByLead[lead.id] ?? []));
  }

  return (
    <AdminOverview
      leads={JSON.parse(JSON.stringify(leads))}
      quarters={JSON.parse(JSON.stringify(quarters))}
      allMembersByLead={allMembersByLeadSerialized}
    />
  );
}
