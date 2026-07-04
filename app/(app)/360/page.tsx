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
          <p className="text-sm text-slate-500 mt-0.5">Summary of 360 assessment progress & results per period.</p>
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
          <p className="text-sm text-slate-500 mt-0.5">Rate the colleagues assigned to you. Your answers are confidential.</p>
        </div>
        <MyAssessment />
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-1">Team Progress</h2>
          <p className="text-sm text-slate-500 mb-3">Track the assessment status of your team members.</p>
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
          Rate the colleagues assigned to you for the active period. Your answers are confidential.
        </p>
      </div>
      <MyAssessment />
    </div>
  );
}
