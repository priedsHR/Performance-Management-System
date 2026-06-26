import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";
import PeriodManager from "./PeriodManager";

export default async function PeriodsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/360");
  await ensureFeedbackBootstrap();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Periode Penilaian (Semester)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Buat periode Mid Year / End Year, aktifkan satu periode untuk membuka penilaian, lalu rilis
          rapor saat siap dibagikan ke karyawan.
        </p>
      </div>
      <PeriodManager />
    </div>
  );
}
