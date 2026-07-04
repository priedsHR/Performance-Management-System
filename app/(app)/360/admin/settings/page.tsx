import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";
import SettingsManager from "./SettingsManager";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/360");
  await ensureFeedbackBootstrap();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">360 Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Rater group weights, level → target mapping, and scoring band thresholds.</p>
      </div>
      <SettingsManager />
    </div>
  );
}
