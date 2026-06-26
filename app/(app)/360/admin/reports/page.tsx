import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";
import ReportsAdmin from "./ReportsAdmin";

export default async function AdminReportsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/360");
  await ensureFeedbackBootstrap();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Rekap Rapor 360</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ringkasan skor seluruh karyawan per periode. Klik untuk membuka rapor detail.</p>
      </div>
      <ReportsAdmin />
    </div>
  );
}
