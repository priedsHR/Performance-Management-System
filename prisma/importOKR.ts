// Import a curated Q1 2026 OKR set (from "2026 OKR Dashboard.xlsx") as
// simulation data: objectives + KRs per division lead, member assignments,
// and Jan-Mar monthly progress snapshots for the monthly charts.
//   npx tsx prisma/importOKR.ts
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type KR = { title: string; target: number; actual: number; unit: string; weight: number };
type Obj = { title: string; weight: number; krs: KR[] };

// leadEmail → objectives (targets/actuals transcribed from the workbook)
const OKRS: Record<string, Obj[]> = {
  "dwita@prieds.com": [
    { title: "Learn, Efficient, and Excellent Team", weight: 100, krs: [
      { title: "Competency Framework finalized & approved by management", target: 1, actual: 1, unit: "pcs", weight: 35 },
      { title: "IDP Standardized", target: 1, actual: 1, unit: "pcs", weight: 35 },
      { title: "Create Leadership Development Program Standardized", target: 1, actual: 0, unit: "pcs", weight: 30 },
    ]},
  ],
  "reggi.prasetyo@prieds.com": [
    { title: "Develop our Product to keep up with market needs", weight: 50, krs: [
      { title: "Develop 3 New Features for Product", target: 3, actual: 3, unit: "pcs", weight: 25 },
      { title: "Improve 6 Existing Features from Product or Project", target: 6, actual: 6, unit: "pcs", weight: 25 },
      { title: "Develop 3 New Features for Android App", target: 3, actual: 2, unit: "pcs", weight: 25 },
      { title: "Finish 3 New Features from Roadmap Q1'26", target: 3, actual: 3, unit: "pcs", weight: 25 },
    ]},
    { title: "Deliver UI/UX & new features per client requests", weight: 25, krs: [
      { title: "Deliver at least 6 UI/UX designs & development with the project team", target: 6, actual: 6, unit: "pcs", weight: 50 },
      { title: "Deliver UI/UX designs for 3 new product features on time", target: 3, actual: 3, unit: "pcs", weight: 50 },
    ]},
    { title: "Make a reliable product that satisfies customers", weight: 25, krs: [
      { title: "Improve retention rate above 70%", target: 70, actual: 62.5, unit: "%", weight: 50 },
      { title: "Resolve 90%+ of all bugs & 100% of urgent bugs on time", target: 90, actual: 90, unit: "%", weight: 50 },
    ]},
  ],
  "randy.tandian@prieds.com": [
    { title: "Complete the Projects On Time", weight: 60, krs: [
      { title: "Complete 90% of project stages on schedule", target: 90, actual: 76, unit: "%", weight: 50 },
      { title: "Keep rework percentage under 10% of total tasks", target: 10, actual: 4.2, unit: "%", weight: 50 },
    ]},
    { title: "Complete each stage of existing projects", weight: 40, krs: [
      { title: "Realize IDR 453.7M project value in Q1", target: 470045000, actual: 40000000, unit: "pcs", weight: 100 },
    ]},
  ],
  "firyal@prieds.com": [
    { title: "Generate Partner Qualified Leads from partner channels", weight: 40, krs: [
      { title: "Achieve 69 PQL from partners", target: 69, actual: 49, unit: "pcs", weight: 100 },
    ]},
    { title: "Activate and engage Sales Referral Program (SRP)", weight: 30, krs: [
      { title: "SRP 2026 launch & onboarding delivered", target: 2, actual: 2, unit: "pcs", weight: 34 },
      { title: "SRP awareness & pitching content per Q1 plan", target: 3, actual: 3, unit: "pcs", weight: 33 },
      { title: "15 SRP partners with min. 1 lead each", target: 15, actual: 15, unit: "pcs", weight: 33 },
    ]},
    { title: "Grow partner-sourced pipeline", weight: 30, krs: [
      { title: "Partner-sourced deals progressing to proposal", target: 10, actual: 7, unit: "pcs", weight: 100 },
    ]},
  ],
  "lita tri@placeholder": [], // (Finance sheet is 2025 — skipped)
  "fuad.hasan@prieds.com": [
    { title: "Hit Q1 new revenue targets", weight: 100, krs: [
      { title: "Revenue WMS Starterpack New (IDR 600M Q1 share)", target: 600000000, actual: 380000000, unit: "pcs", weight: 40 },
      { title: "Revenue Premium New (IDR 1B Q1 share)", target: 1000000000, actual: 640000000, unit: "pcs", weight: 40 },
      { title: "Revenue Hardware & Consumables (IDR 700M Q1 share)", target: 700000000, actual: 520000000, unit: "pcs", weight: 20 },
    ]},
  ],
};

async function main() {
  // quarter
  const existingQ = await prisma.quarter.findFirst({ where: { year: 2026, quarter: 1 } });
  const quarter = existingQ
    ? await prisma.quarter.update({ where: { id: existingQ.id }, data: { isActive: true } })
    : await prisma.quarter.create({
        data: { name: "Q1 2026", year: 2026, quarter: 1, isActive: true, startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31") },
      });
  await prisma.quarter.updateMany({ where: { id: { not: quarter.id } }, data: { isActive: false } });
  console.log("Quarter:", quarter.name);

  for (const [email, objs] of Object.entries(OKRS)) {
    if (!objs.length) continue;
    const lead = await prisma.user.findUnique({ where: { email } });
    if (!lead) { console.log("skip (no user):", email); continue; }

    // wipe this lead's Q1-2026 objectives for idempotency
    await prisma.objective.deleteMany({ where: { userId: lead.id, quarterId: quarter.id } });

    // direct reports (360 org chart) as team members
    const reports = await prisma.feedbackProfile.findMany({
      where: { managerId: lead.id, active: true },
      include: { user: { select: { id: true, name: true } } },
    });
    const memberIds: string[] = [];
    for (const r of reports) {
      const tm = await prisma.teamMember.upsert({
        where: { userId: r.userId },
        update: { leadId: lead.id, name: r.user.name },
        create: { name: r.user.name, leadId: lead.id, userId: r.userId },
      });
      memberIds.push(tm.id);
    }

    for (const o of objs) {
      const objective = await prisma.objective.create({
        data: {
          title: o.title, weight: o.weight, status: "SUBMITTED", submittedAt: new Date(),
          userId: lead.id, quarterId: quarter.id,
          keyResults: { create: o.krs.map((kr) => ({ title: kr.title, target: kr.target, unit: kr.unit, weight: kr.weight, teamProgress: kr.actual })) },
        },
        include: { keyResults: true },
      });
      for (const memberId of memberIds) {
        await prisma.objectiveAssignment.create({
          data: {
            memberId, objectiveId: objective.id, weight: o.weight,
            krAssignments: { create: objective.keyResults.map((kr) => ({ keyResultId: kr.id, weight: kr.weight, progress: kr.teamProgress })) },
          },
        });
      }
    }

    // monthly snapshots Jan–Mar: ramp to the final achievement
    for (const memberId of memberIds) {
      const finalAch = objs.reduce((sObj, o) => {
        const wSum = o.krs.reduce((x, k) => x + k.weight, 0) || 1;
        const objAch = o.krs.reduce((x, k) => x + Math.min((k.actual / k.target) * 100, 100) * (k.weight / wSum), 0);
        return sObj + objAch * (o.weight / 100);
      }, 0);
      const ramps = [0.35, 0.7, 1.0];
      for (let i = 0; i < 3; i++) {
        const month = `2026-0${i + 1}`;
        await prisma.progressSnapshot.upsert({
          where: { memberId_quarterId_month: { memberId, quarterId: quarter.id, month } },
          update: { achievement: finalAch * ramps[i] },
          create: { memberId, quarterId: quarter.id, month, achievement: finalAch * ramps[i] },
        });
      }
    }
    console.log(`${email}: ${objs.length} objectives, ${memberIds.length} members assigned`);
  }
  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
