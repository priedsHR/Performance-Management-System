import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettingsIssues, getCollectionIssues } from "@/lib/reminder-issues";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quarterId = req.nextUrl.searchParams.get("quarterId");
  if (!quarterId) return NextResponse.json({ error: "quarterId is required." }, { status: 400 });

  const leads = await prisma.user.findMany({
    where: { role: "LEAD" },
    select: { id: true, name: true, email: true, division: true },
    orderBy: { name: "asc" },
  });

  const results = await Promise.all(
    leads.map(async (lead) => {
      const [settingsIssues, collectionIssues] = await Promise.all([
        getSettingsIssues(lead.id, quarterId),
        getCollectionIssues(lead.id, quarterId),
      ]);

      const toStatus = (issues: typeof settingsIssues) => {
        if (issues.hasNoObjectives) return "empty";
        if (issues.summaryIssues.length === 0 && issues.objectives.length === 0) return "complete";
        return "incomplete";
      };

      return {
        id: lead.id,
        name: lead.name ?? "-",
        email: lead.email ?? "",
        division: lead.division ?? null,
        settingsStatus: toStatus(settingsIssues),
        collectionStatus: toStatus(collectionIssues),
      };
    })
  );

  return NextResponse.json(results);
}
