import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NorthStarChart from "./NorthStarChart";

export default async function NorthStarPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN" && session?.user.role !== "LEAD") redirect("/dashboard");
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">North Star — Company OKR Trajectory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Division achievement per quarter with the company average — presentation-ready for leadership reviews.
          </p>
        </div>
      </div>
      <NorthStarChart />
    </div>
  );
}
