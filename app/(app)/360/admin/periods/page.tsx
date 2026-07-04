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
        <h1 className="text-xl font-bold text-slate-900">Assessment Periods (Semester)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Create Mid Year / End Year periods, activate one period to open assessments, then release
          reports when they are ready to share with employees.
        </p>
      </div>
      <PeriodManager />
    </div>
  );
}
