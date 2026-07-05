import { auth } from "@/auth";
import IdpForm from "./IdpForm";
import IdpList from "./IdpList";

export default async function IdpPage() {
  const session = await auth();
  const role = session!.user.role;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Individual Development Plan</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Bridge the gap between your current performance (360 / OKR) and your future level. One plan per semester,
          built on the 70-20-10 model.
        </p>
      </div>
      <IdpForm />
      {(role === "ADMIN" || role === "LEAD") && (
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-1">{role === "ADMIN" ? "All Plans" : "Team Plans"}</h2>
          <p className="text-sm text-slate-500 mb-3">
            {role === "ADMIN" ? "Every submitted IDP for the selected semester." : "IDPs from your direct reports."}
            {" "}Add a coaching note after the 1-on-1 discussion.
          </p>
          <IdpList />
        </div>
      )}
    </div>
  );
}
