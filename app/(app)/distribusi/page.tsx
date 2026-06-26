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
        <h1 className="text-xl font-bold text-slate-900">👥 Distribusi Anggota</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">
          Belum ada quarter. Buat quarter terlebih dahulu.
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
          Pilih quarter di atas untuk melihat distribusi.
        </div>
      </div>
    );
  }

  const objectives = await prisma.objective.findMany({
    where: { userId: session!.user.id, quarterId: selectedQuarter.id },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });

  const quarterObjectiveIds = objectives.map((o) => o.id);

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
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="font-semibold">Belum ada OKR Divisi untuk {selectedQuarter.name}</p>
            <p className="mt-0.5 text-amber-600">
              Buat objective & key result di halaman{" "}
              <a href={`/okr?quarterId=${selectedQuarter.id}`} className="underline font-semibold hover:text-amber-800">
                OKR Divisi
              </a>{" "}
              terlebih dahulu sebelum mendistribusikan ke anggota.
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
    </div>
  );
}
