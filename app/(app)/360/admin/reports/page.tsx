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
        <h1 className="text-xl font-bold text-slate-900">360 Report Recap</h1>
        <p className="text-sm text-slate-500 mt-0.5">Score summary for all employees per period. Click to open a detailed report.</p>
      </div>
      <ReportsAdmin />
    </div>
  );
}
