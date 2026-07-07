import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import OKRManager from "./OKRManager";
import ImportExportSection from "./ImportExportSection";
import QuarterSelector from "./QuarterSelector";
import CollapsibleSection from "./CollapsibleSection";

export default async function OKRPage({ searchParams }: { searchParams: Promise<{ quarterId?: string }> }) {
  const session = await auth();
  const isLead = session!.user.role === "LEAD" || session!.user.role === "ADMIN";

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
        <h1 className="text-xl font-bold text-slate-900">{isLead ? "Division OKR" : "My OKR"}</h1>
        {isLead ? (
          <QuarterSelector quarters={[]} selectedQuarterId={null} isLead={isLead} />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">
            No quarter. Tunggu Lead atau Admin membuat quarter terlebih dahulu.
          </div>
        )}
      </div>
    );
  }

  if (!selectedQuarter) {
    return (
      <div className="space-y-4">
        <QuarterSelector quarters={JSON.parse(JSON.stringify(quarters))} selectedQuarterId={null} isLead={isLead} />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">
          Select quarter di atas untuk melihat OKR.
        </div>
      </div>
    );
  }

  const objectives = await prisma.objective.findMany({
    where: { userId: session!.user.id, quarterId: selectedQuarter.id },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate member progress dari KRAssignment ke teamProgress tiap KR
  const krIds = objectives.flatMap((o) => o.keyResults.map((kr) => kr.id));
  const allKRAssignments = krIds.length > 0
    ? await prisma.kRAssignment.findMany({
        where: { keyResultId: { in: krIds } },
        select: { keyResultId: true, weight: true, progress: true, target: true },
      })
    : [];
  const krProgressMap = new Map<string, number[]>();
  for (const kra of allKRAssignments) {
    const list = krProgressMap.get(kra.keyResultId) ?? [];
    list.push(kra.progress);
    krProgressMap.set(kra.keyResultId, list);
  }
  const enrichedObjectives = objectives.map((obj) => ({
    ...obj,
    keyResults: obj.keyResults.map((kr) => {
      const list = krProgressMap.get(kr.id);
      if (!list || list.length === 0) return kr;
      const teamProgress =
        kr.unit === "%"
          ? list.reduce((s, v) => s + v, 0) / list.length
          : list.reduce((s, v) => s + v, 0);
      return { ...kr, teamProgress };
    }),
  }));

  const objCount = objectives.length;
  const submittedCount = objectives.filter((o) => o.status === "SUBMITTED").length;

  return (
    <div className="space-y-4">
      {/* Quarter selector */}
      <QuarterSelector
        quarters={JSON.parse(JSON.stringify(quarters))}
        selectedQuarterId={selectedQuarter.id}
        isLead={isLead}
      />

      {/* Bagian 1: OKR + Import/Export (satu section) */}
      <CollapsibleSection
        title={isLead ? "Division OKR" : "My OKR"}
        subtitle={selectedQuarter.name}
        badge={
          objCount > 0 ? (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {submittedCount}/{objCount} dikumpulkan
            </span>
          ) : undefined
        }
        defaultOpen={true}
      >
        <OKRManager
          initialObjectives={JSON.parse(JSON.stringify(enrichedObjectives))}
          quarterId={selectedQuarter.id}
          userId={session!.user.id}
          allQuarters={JSON.parse(JSON.stringify(quarters))}
          isLead={isLead}
        />
        {/* Import/Export OKR — sub-panel di bawah OKR manager */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">📁 Import / Export OKR</span>
            <span className="text-xs text-slate-300">—</span>
            <span className="text-xs text-slate-400">download template → isi → upload, atau ekspor ke Excel</span>
          </div>
          <ImportExportSection quarterId={selectedQuarter.id} />
        </div>
      </CollapsibleSection>

      {/* Link ke Distribusi Member untuk LEAD */}
      {isLead && (
        <a
          href={`/distribusi?quarterId=${selectedQuarter.id}`}
          className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-amber-300 hover:bg-amber-50/30 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">👥</span>
            <div>
              <p className="font-semibold text-slate-800 text-sm group-hover:text-amber-700 transition-colors">
                Distribusi ke Member
              </p>
              <p className="text-xs text-slate-400">
                Assign objectives &amp; KRs to members, set weights and individual targets
              </p>
            </div>
          </div>
          <span className="text-slate-300 group-hover:text-amber-500 transition-colors text-lg">→</span>
        </a>
      )}
    </div>
  );
}
