import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail, type ReminderType } from "@/lib/email";
import { getSettingsIssues, getCollectionIssues } from "@/lib/reminder-issues";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, quarterId }: { type: ReminderType; quarterId: string } = await req.json();

  if (!type || !quarterId) {
    return NextResponse.json({ error: "type and quarterId are required." }, { status: 400 });
  }

  const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
  if (!quarter) return NextResponse.json({ error: "Quarter not found." }, { status: 404 });

  const leads = await prisma.user.findMany({
    where: { role: "LEAD" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  if (leads.length === 0) return NextResponse.json({ error: "No Division Leads registered." }, { status: 404 });

  const results: { name: string; email: string; status: "sent" | "skipped" | "error"; reason?: string; error?: string }[] = [];

  for (const lead of leads) {
    if (!lead.email) {
      results.push({ name: lead.name ?? "-", email: "-", status: "error", error: "Tidak ada email" });
      continue;
    }

    const completionIssues =
      type === "settings"
        ? await getSettingsIssues(lead.id, quarterId)
        : await getCollectionIssues(lead.id, quarterId);

    const isComplete =
      !completionIssues.hasNoObjectives &&
      completionIssues.summaryIssues.length === 0 &&
      completionIssues.objectives.length === 0;

    if (isComplete) {
      results.push({ name: lead.name ?? "-", email: lead.email, status: "skipped", reason: "OKR is complete ✅" });
      continue;
    }

    try {
      await sendReminderEmail({ to: lead.email, name: lead.name ?? lead.email, type, quarterName: quarter.name, quarterId, completionIssues });
      results.push({ name: lead.name ?? "-", email: lead.email, status: "sent" });
    } catch (err) {
      results.push({ name: lead.name ?? "-", email: lead.email, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const errCount = results.filter((r) => r.status === "error").length;

  const parts = [];
  if (sentCount > 0) parts.push(`${sentCount} emails sent`);
  if (skippedCount > 0) parts.push(`${skippedCount} already complete (not sent)`);
  if (errCount > 0) parts.push(`${errCount} failed`);

  return NextResponse.json({ success: sentCount > 0 || skippedCount > 0, message: parts.join(", ") + ".", results });
}
