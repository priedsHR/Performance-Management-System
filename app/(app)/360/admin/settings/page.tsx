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
        <h1 className="text-xl font-bold text-slate-900">Pengaturan 360</h1>
        <p className="text-sm text-slate-500 mt-0.5">Bobot kelompok penilai, pemetaan level → target, dan ambang band penilaian.</p>
      </div>
      <SettingsManager />
    </div>
  );
}
