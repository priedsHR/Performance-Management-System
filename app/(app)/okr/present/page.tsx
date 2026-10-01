import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PresentDeck from "./PresentDeck";

const krInclude = {
  user: { select: { name: true } },
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
  searchParams: Promise<{ division?: string; quarterId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { division, quarterId } = await searchParams;
  if (!division || !quarterId) redirect("/company-okr");

  const curQ = await prisma.quarter.findUnique({ where: { id: quarterId } });
  if (!curQ) redirect("/company-okr");

  const nextQ = await prisma.quarter.findFirst({
    where: { OR: [{ year: { gt: curQ.year } }, { year: curQ.year, quarter: { gt: curQ.quarter } }] },
    orderBy: [{ year: "asc" }, { quarter: "asc" }],
  });

  const members = await prisma.user.findMany({ where: { division }, select: { id: true } });
  const memberIds = members.map((m) => m.id);

  const [curObjectives, nextObjectives] = await Promise.all([
    prisma.objective.findMany({ where: { userId: { in: memberIds }, quarterId: curQ.id }, include: krInclude, orderBy: { createdAt: "asc" } }),
    nextQ
      ? prisma.objective.findMany({ where: { userId: { in: memberIds }, quarterId: nextQ.id }, include: krInclude, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);

  const curMonths = [0, 1, 2].map((i) => (curQ.quarter - 1) * 3 + 1 + i);

  return (
    <PresentDeck
      division={division}
      curQuarter={{ name: curQ.name, year: curQ.year, quarter: curQ.quarter }}
      nextQuarter={nextQ ? { name: nextQ.name } : null}
      curMonths={curMonths}
      curObjectives={JSON.parse(JSON.stringify(curObjectives))}
      nextObjectives={JSON.parse(JSON.stringify(nextObjectives))}
    />
  );
}
