import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Reminder360Manager from "./Reminder360Manager";

export default async function Reminders360Page() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const periods = await prisma.feedbackPeriod.findMany({
    orderBy: [{ year: "desc" }, { half: "desc" }],
    select: { id: true, name: true, half: true, year: true, isActive: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Reminder 360 Feedback</h1>
        <p className="text-sm text-slate-400">Send reminder emails to employees who have not completed their 360° assessment.</p>
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Send Now</h2>
        <Reminder360Manager periods={JSON.parse(JSON.stringify(periods))} />
      </div>
    </div>
  );
}
