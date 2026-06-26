import { prisma } from "@/lib/prisma";
import { sendReminderEmail, type ReminderType } from "@/lib/email";
import { getSettingsIssues, getCollectionIssues, computeNextRunAfter } from "@/lib/reminder-issues";

export async function processDueSchedules(): Promise<void> {
  const now = new Date();

  const dueSchedules = await prisma.reminderSchedule.findMany({
    where: { isActive: true, nextRun: { lte: now } },
    include: { quarter: true },
  });

  if (dueSchedules.length === 0) return;

  const leads = await prisma.user.findMany({
    where: { role: "LEAD" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  for (const schedule of dueSchedules) {
    for (const lead of leads) {
      if (!lead.email) continue;

      const issues =
        schedule.type === "settings"
          ? await getSettingsIssues(lead.id, schedule.quarterId)
          : await getCollectionIssues(lead.id, schedule.quarterId);

      const isComplete =
        !issues.hasNoObjectives &&
        issues.summaryIssues.length === 0 &&
        issues.objectives.length === 0;

      if (isComplete) continue;

      try {
        await sendReminderEmail({
          to: lead.email,
          name: lead.name ?? lead.email,
          type: schedule.type as ReminderType,
          quarterName: schedule.quarter.name,
          quarterId: schedule.quarterId,
          completionIssues: issues,
        });
      } catch {
        // continue sending to other leads even if one fails
      }
    }

    const nextRun = computeNextRunAfter(
      schedule.frequency as "weekly" | "biweekly" | "monthly",
      schedule.dayOfMonth,
      schedule.hourWIB,
      now,
    );

    await prisma.reminderSchedule.update({
      where: { id: schedule.id },
      data: { lastRun: now, nextRun },
    });
  }
}
