import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PresentView from "./PresentView";

const krInclude = {
  keyResults: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      initiatives: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          pic: { select: { id: true, name: true } },
          monthly: { orderBy: [{ year: "asc" as const }, { month: "asc" as const }] },
        },
      },
    },
  },
};

export default async function PresentPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; quarterId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { userId, quarterId } = await searchParams;
  if (!userId || !quarterId) redirect("/company-okr");

  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, division: true } });
  const curQ = await prisma.quarter.findUnique({ where: { id: quarterId } });
  if (!owner || !curQ) redirect("/company-okr");

  // The quarter immediately after the current one (for the plan).
  const nextQ = await prisma.quarter.findFirst({
    where: { OR: [{ year: { gt: curQ.year } }, { year: curQ.year, quarter: { gt: curQ.quarter } }] },
    orderBy: [{ year: "asc" }, { quarter: "asc" }],
  });

  const [curObjectives, nextObjectives] = await Promise.all([
    prisma.objective.findMany({ where: { userId, quarterId: curQ.id }, include: krInclude, orderBy: { createdAt: "asc" } }),
    nextQ
      ? prisma.objective.findMany({ where: { userId, quarterId: nextQ.id }, include: krInclude, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);

  const curMonths = [0, 1, 2].map((i) => (curQ.quarter - 1) * 3 + 1 + i);

  return (
    <PresentView
      owner={owner}
      curQuarter={{ name: curQ.name, year: curQ.year, quarter: curQ.quarter }}
      nextQuarter={nextQ ? { name: nextQ.name } : null}
      curMonths={curMonths}
      curObjectives={JSON.parse(JSON.stringify(curObjectives))}
      nextObjectives={JSON.parse(JSON.stringify(nextObjectives))}
    />
  );
}
