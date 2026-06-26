import { prisma } from "@/lib/prisma";
import type { CompletionIssues, ObjectiveIssue } from "@/lib/email";

// ─── Issue computation ───────────────────────────────────────────────────────

export async function getSettingsIssues(leadId: string, quarterId: string): Promise<CompletionIssues> {
  const objectives = await prisma.objective.findMany({
    where: { userId: leadId, quarterId },
    select: {
      id: true, title: true, weight: true, status: true,
      keyResults: {
        select: {
          id: true, title: true, weight: true, target: true, unit: true,
          krAssignments: {
            select: { weight: true, assignment: { select: { member: { select: { name: true } } } } },
          },
        },
      },
    },
  });

  if (objectives.length === 0) return { hasNoObjectives: true, summaryIssues: [], objectives: [] };

  const summaryIssues: string[] = [];
  const totalObjWeight = objectives.reduce((s, obj) => s + obj.weight, 0);
  if (Math.abs(totalObjWeight - 100) > 0.1)
    summaryIssues.push(`Total bobot semua Objective: ${totalObjWeight.toFixed(0)}% (harus 100%)`);

  const objectiveIssues: ObjectiveIssue[] = [];

  for (const obj of objectives) {
    const issues: string[] = [];
    if (obj.status === "DRAFT") issues.push("Belum dikumpulkan (masih Draft)");

    if (obj.keyResults.length === 0) {
      issues.push("Belum ada Key Result yang dibuat");
      objectiveIssues.push({ title: obj.title, issues, krIssues: [] });
      continue;
    }

    const totalKRWeight = obj.keyResults.reduce((s, kr) => s + kr.weight, 0);
    if (Math.abs(totalKRWeight - 100) > 0.1)
      issues.push(`Total bobot KR: ${totalKRWeight.toFixed(0)}% (harus 100%)`);

    const krIssues = obj.keyResults.flatMap((kr) => {
      const krIss: string[] = [];
      if (kr.weight === 0) krIss.push("bobot 0%");
      if (kr.target === 0) krIss.push("target belum diisi");
      if (!kr.unit || kr.unit.trim() === "") krIss.push("satuan belum dipilih");
      return krIss.length > 0 ? [{ title: kr.title, issues: krIss }] : [];
    });

    const memberWeightMap = new Map<string, number>();
    for (const kr of obj.keyResults)
      for (const kra of kr.krAssignments) {
        const name = kra.assignment.member.name;
        memberWeightMap.set(name, (memberWeightMap.get(name) ?? 0) + kra.weight);
      }
    for (const [name, total] of memberWeightMap.entries())
      if (Math.abs(total - 100) > 0.1)
        issues.push(`Bobot ${name}: ${total.toFixed(0)}% (harus 100%)`);

    if (issues.length > 0 || krIssues.length > 0)
      objectiveIssues.push({ title: obj.title, issues, krIssues });
  }

  return { hasNoObjectives: false, summaryIssues, objectives: objectiveIssues };
}

export async function getCollectionIssues(leadId: string, quarterId: string): Promise<CompletionIssues> {
  const objectives = await prisma.objective.findMany({
    where: { userId: leadId, quarterId },
    select: {
      id: true, title: true, weight: true,
      keyResults: {
        select: {
          id: true, title: true, weight: true, target: true, unit: true,
          krAssignments: {
            select: { weight: true, progress: true, assignment: { select: { member: { select: { name: true } } } } },
          },
        },
      },
    },
  });

  if (objectives.length === 0) return { hasNoObjectives: true, summaryIssues: [], objectives: [] };

  const summaryIssues: string[] = [];
  const totalObjWeight = objectives.reduce((s, obj) => s + obj.weight, 0);
  if (Math.abs(totalObjWeight - 100) > 0.1)
    summaryIssues.push(`Total bobot semua Objective: ${totalObjWeight.toFixed(0)}% (harus 100%)`);

  const objectiveIssues: ObjectiveIssue[] = [];

  for (const obj of objectives) {
    const issues: string[] = [];

    if (obj.keyResults.length === 0) {
      issues.push("Belum ada Key Result yang dibuat");
      objectiveIssues.push({ title: obj.title, issues, krIssues: [] });
      continue;
    }

    const totalKRWeight = obj.keyResults.reduce((s, kr) => s + kr.weight, 0);
    if (Math.abs(totalKRWeight - 100) > 0.1)
      issues.push(`Total bobot KR: ${totalKRWeight.toFixed(0)}% (harus 100%)`);

    const memberWeightMap = new Map<string, number>();
    for (const kr of obj.keyResults)
      for (const kra of kr.krAssignments) {
        const name = kra.assignment.member.name;
        memberWeightMap.set(name, (memberWeightMap.get(name) ?? 0) + kra.weight);
      }
    for (const [name, total] of memberWeightMap.entries())
      if (Math.abs(total - 100) > 0.1)
        issues.push(`Bobot ${name}: ${total.toFixed(0)}% (harus 100%)`);

    const krIssues = obj.keyResults.flatMap((kr) => {
      const krIss: string[] = [];
      if (kr.weight === 0) krIss.push("bobot 0%");
      if (kr.target === 0) krIss.push("target belum diisi");
      if (!kr.unit || kr.unit.trim() === "") krIss.push("satuan belum dipilih");
      const emptyMembers = kr.krAssignments.filter((a) => a.progress === 0).map((a) => a.assignment.member.name);
      if (emptyMembers.length > 0) krIss.push(`progress belum diisi: ${emptyMembers.join(", ")}`);
      return krIss.length > 0 ? [{ title: kr.title, issues: krIss }] : [];
    });

    if (issues.length > 0 || krIssues.length > 0)
      objectiveIssues.push({ title: obj.title, issues, krIssues });
  }

  return { hasNoObjectives: false, summaryIssues, objectives: objectiveIssues };
}

// ─── Schedule timing ──────────────────────────────────────────────────────────

// hourWIB is Jakarta time (UTC+7). Cron runs in UTC so we convert.
function hourWIBtoUTC(h: number) { return (h - 7 + 24) % 24; }

/** Compute the first nextRun when creating a new schedule */
export function computeInitialNextRun(
  frequency: "weekly" | "biweekly" | "monthly",
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  hourWIB: number
): Date {
  const hourUTC = hourWIBtoUTC(hourWIB);
  const now = new Date();

  if (frequency === "monthly") {
    let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth!, hourUTC, 0, 0, 0));
    if (d <= now) d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dayOfMonth!, hourUTC, 0, 0, 0));
    return d;
  }

  // weekly / biweekly: find next occurrence of dayOfWeek
  let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUTC, 0, 0, 0));
  const daysUntil = (() => {
    const diff = (dayOfWeek! - d.getUTCDay() + 7) % 7;
    return diff === 0 && d <= now ? 7 : diff;
  })();
  d.setUTCDate(d.getUTCDate() + daysUntil);
  return d;
}

/** Compute the next nextRun after a schedule has just fired */
export function computeNextRunAfter(
  frequency: "weekly" | "biweekly" | "monthly",
  dayOfMonth: number | null,
  hourWIB: number,
  lastRun: Date
): Date {
  const hourUTC = hourWIBtoUTC(hourWIB);
  if (frequency === "monthly") {
    return new Date(Date.UTC(lastRun.getUTCFullYear(), lastRun.getUTCMonth() + 1, dayOfMonth!, hourUTC, 0, 0, 0));
  }
  const days = frequency === "biweekly" ? 14 : 7;
  return new Date(lastRun.getTime() + days * 86400_000);
}
