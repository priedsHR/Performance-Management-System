import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";
import CompetencyManager from "./CompetencyManager";

export default async function CompetenciesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/360");
  await ensureFeedbackBootstrap();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Competency Framework</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Add, edit, or deactivate competencies. Core applies to everyone; Leadership to
          managers; Job Family & Technical follow the department.
        </p>
      </div>
      <CompetencyManager />
    </div>
  );
}
