import { after } from "next/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettingsIssues, getCollectionIssues } from "@/lib/reminder-issues";
import { processDueSchedules } from "@/lib/process-schedules";
import ReminderManager from "./ReminderManager";
import ScheduleManager from "./ScheduleManager";

export type LeadStatus = "complete" | "incomplete" | "empty";

export default async function RemindersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  // Fire any due schedules in background after page renders — no cron needed
  after(processDueSchedules);

  const quarters = await prisma.quarter.findMany({
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
    select: { id: true, name: true, year: true, quarter: true, isActive: true },
  });

  const activeQuarter = quarters.find((q) => q.isActive) ?? quarters[0];

  const leads = await prisma.user.findMany({
    where: { role: "LEAD" },
    select: { id: true, name: true, email: true, division: true },
    orderBy: { name: "asc" },
  });

  const leadsWithStatus = await Promise.all(
    leads.map(async (lead) => {
      const base = { id: lead.id, name: lead.name ?? "-", email: lead.email ?? "", division: lead.division ?? null };
      if (!activeQuarter) return { ...base, settingsStatus: "empty" as LeadStatus, collectionStatus: "empty" as LeadStatus };

      const [settingsIssues, collectionIssues] = await Promise.all([
        getSettingsIssues(lead.id, activeQuarter.id),
        getCollectionIssues(lead.id, activeQuarter.id),
      ]);

      const toStatus = (issues: typeof settingsIssues): LeadStatus => {
        if (issues.hasNoObjectives) return "empty";
        if (issues.summaryIssues.length === 0 && issues.objectives.length === 0) return "complete";
        return "incomplete";
      };

      return { ...base, settingsStatus: toStatus(settingsIssues), collectionStatus: toStatus(collectionIssues) };
    })
  );

  const schedules = await prisma.reminderSchedule.findMany({
    include: { quarter: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Reminder</h1>
        <p className="text-sm text-slate-400">Send manually or set an automatic schedule for all Division Leads.</p>
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Send Now</h2>
        <ReminderManager quarters={JSON.parse(JSON.stringify(quarters))} initialLeads={leadsWithStatus} />
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Automatic Schedules</h2>
        <ScheduleManager
          quarters={JSON.parse(JSON.stringify(quarters))}
          initialSchedules={JSON.parse(JSON.stringify(schedules))}
        />
      </div>
    </div>
  );
}
