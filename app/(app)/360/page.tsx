import { auth } from "@/auth";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";
import MyAssessment from "./MyAssessment";
import Dashboard360 from "./Dashboard360";
import LeadDashboard360 from "./LeadDashboard360";

export default async function FeedbackHome() {
  const session = await auth();
  await ensureFeedbackBootstrap();

  if (session!.user.role === "ADMIN") {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard 360</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ringkasan pelaksanaan & hasil penilaian 360 per periode.</p>
        </div>
        <Dashboard360 />
      </div>
    );
  }

  if (session!.user.role === "LEAD") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">360° Feedback</h1>
          <p className="text-sm text-slate-500 mt-0.5">Nilai kolega yang ditugaskan kepadamu. Jawabanmu bersifat rahasia.</p>
        </div>
        <MyAssessment />
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-1">Progress Tim</h2>
          <p className="text-sm text-slate-500 mb-3">Pantau status penilaian anggota tim kamu.</p>
          <LeadDashboard360 />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">360° Feedback</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Nilai kolega yang ditugaskan kepadamu pada periode aktif. Jawabanmu bersifat rahasia.
        </p>
      </div>
      <MyAssessment />
    </div>
  );
}
