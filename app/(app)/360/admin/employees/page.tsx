import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";
import EmployeeManager360 from "./EmployeeManager360";

export default async function EmployeesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/360");
  await ensureFeedbackBootstrap();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Employee Data (360)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Each employee has one login account. Department determines peers; the manager determines
          who rates whom. Start from scratch — add one by one or bulk import from Excel.
        </p>
      </div>
      <EmployeeManager360 />
    </div>
  );
}
