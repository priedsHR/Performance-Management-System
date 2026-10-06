import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DistribusiAnggota from "../okr/DistribusiAnggota";
import QuarterSelector from "../okr/QuarterSelector";

export default async function DistribusiPage({
  searchParams,
}: {
  searchParams: Promise<{ quarterId?: string }>;
}) {
  const session = await auth();
  const isLead = session!.user.role === "LEAD" || session!.user.role === "ADMIN";

  if (!isLead) redirect("/dashboard");

  const { quarterId: selectedId } = await searchParams;

  const quarters = await prisma.quarter.findMany({
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  });

  const selectedQuarter = selectedId
    ? quarters.find((q) => q.id === selectedId)
    : quarters.find((q) => q.isActive) ?? quarters[0];

  if (quarters.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Member Distribution</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">
          No quarters. Create a quarter first.
        </div>
      </div>
    );
  }

  if (!selectedQuarter) {
    return (
      <div className="space-y-4">
        <QuarterSelector
          quarters={JSON.parse(JSON.stringify(quarters))}
          selectedQuarterId={null}
          isLead={isLead}
          basePath="/distribusi"
        />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">
          Select a quarter above to view the distribution.
        </div>
      </div>
    );
  }

  const objectives = await prisma.objective.findMany({
    where: { userId: session!.user.id, quarterId: selectedQuarter.id },
    include: { keyResults: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: { createdAt: "asc" },
  });

  const quarterObjectiveIds = objectives.map((o) => o.id);

  // Initiatives assigned to a member as PIC (set in the OKR editor). Shown as a
  // read-only summary so leads can see who owns which initiative.
  const picInitiatives = quarterObjectiveIds.length
    ? await prisma.initiative.findMany({
        where: { picId: { not: null }, keyResult: { objectiveId: { in: quarterObjectiveIds } } },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, title: true, target: true, actual: true, unit: true,
          pic: { select: { name: true } },
          keyResult: { select: { title: true, objective: { select: { title: true } } } },
        },
      })
    : [];
  const picByMember = new Map<string, typeof picInitiatives>();
  for (const it of picInitiatives) {
    const name = it.pic?.name ?? "—";
    if (!picByMember.has(name)) picByMember.set(name, []);
    picByMember.get(name)!.push(it);
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { leadId: session!.user.id },
    include: {
      assignments: {
        where: { objectiveId: { in: quarterObjectiveIds } },
        include: {
          objective: { select: { id: true, title: true } },
          krAssignments: {
            include: {
              keyResult: {
                select: { id: true, title: true, target: true, unit: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <QuarterSelector
        quarters={JSON.parse(JSON.stringify(quarters))}
        selectedQuarterId={selectedQuarter.id}
        isLead={isLead}
        basePath="/distribusi"
      />

      {objectives.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-700 flex items-start gap-3">
          <span className="text-lg flex-shrink-0"></span>
          <div>
            <p className="font-semibold">No Division OKR for {selectedQuarter.name}</p>
            <p className="mt-0.5 text-amber-600">
              Create objectives & key results on the{" "}
              <a href={`/okr?quarterId=${selectedQuarter.id}`} className="underline font-semibold hover:text-amber-800">
                Division OKR
              </a>{" "}
              page first before distributing them to members.
            </p>
          </div>
        </div>
      )}

      <DistribusiAnggota
        initialMembers={JSON.parse(JSON.stringify(teamMembers))}
        objectives={JSON.parse(JSON.stringify(objectives))}
        leadId={session!.user.id}
        quarterId={selectedQuarter.id}
        allQuarters={JSON.parse(JSON.stringify(quarters))}
        leadDivision={session!.user.division ?? undefined}
      />

      {/* Read-only: initiatives assigned to each member as PIC (set in Division OKR) */}
      {picInitiatives.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-sm">Initiatives by member (PIC)</h2>
            <p className="text-xs text-slate-400 mt-0.5">Assigned in the <a href={`/okr?quarterId=${selectedQuarter.id}`} className="text-amber-600 hover:underline font-semibold">Division OKR</a> editor · {selectedQuarter.name}. Members also see these on their own dashboard.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {[...picByMember.entries()].map(([name, inits]) => {
              const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={name} className="px-5 py-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-7 h-7 rounded-full bg-[#d9f2fb] text-[#097eb9] text-xs font-bold flex items-center justify-center flex-shrink-0">{initials}</span>
                    <p className="text-sm font-semibold text-slate-800">{name}</p>
                    <span className="text-xs text-slate-400">{inits.length} initiative{inits.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="space-y-2 sm:pl-9">
                    {inits.map((it) => {
                      const pct = it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0;
                      const tone = pct >= 100 ? "bg-green-50 text-green-700" : pct >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";
                      return (
                        <div key={it.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-700 leading-snug">{it.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{it.keyResult.objective.title} · {it.keyResult.title}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                            <span className="text-xs text-slate-500 tabular-nums">{it.actual}/{it.target}{it.unit ? ` ${it.unit}` : ""}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${tone}`}>{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
