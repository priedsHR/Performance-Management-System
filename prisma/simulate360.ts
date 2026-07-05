// 360 trial simulator — fills the active period with random submitted responses,
// like the prototype's "Simulate responses" button.
//
//   npx tsx prisma/simulate360.ts          → create demo employees (if <3 profiles), fill responses
//   npx tsx prisma/simulate360.ts --clean  → remove demo employees + all simulated responses
//
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL_SUFFIX = "@demo360.local";

const DEMO_EMPLOYEES = [
  // [name, department, position, level, isManager, managerEmailKey]
  ["Andi Wijaya", "Tech", "CTO", "C-Suites", true, null],
  ["Budi Santoso", "Tech", "Backend Developer", "Officer", false, "andi.wijaya"],
  ["Citra Lestari", "Tech", "Frontend Developer", "Sr Officer", false, "andi.wijaya"],
  ["Dewi Anggraini", "Commercial", "Sales Manager", "Manager", true, "andi.wijaya"],
  ["Eko Prasetyo", "Commercial", "Account Executive", "Officer", false, "dewi.anggraini"],
  ["Fitri Handayani", "Operations", "HR Officer", "Officer", false, "dewi.anggraini"],
] as const;

const emailFor = (name: string) =>
  name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".") + DEMO_EMAIL_SUFFIX;

async function clean() {
  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: DEMO_EMAIL_SUFFIX } } });
  const ids = demoUsers.map((u) => u.id);
  const delResp = await prisma.feedbackResponse.deleteMany({
    where: { OR: [{ raterId: { in: ids } }, { rateeId: { in: ids } }] },
  });
  await prisma.feedbackComment.deleteMany({ where: { OR: [{ raterId: { in: ids } }, { rateeId: { in: ids } }] } }).catch(() => null);
  await prisma.user.deleteMany({ where: { id: { in: ids } } }); // cascades profiles
  console.log(`Removed ${demoUsers.length} demo employees and ${delResp.count} responses.`);
}

async function main() {
  if (process.argv.includes("--clean")) return clean();

  // 1. Active period (create one if missing)
  let period = await prisma.feedbackPeriod.findFirst({ where: { isActive: true } });
  if (!period) {
    const year = new Date().getFullYear();
    period = await prisma.feedbackPeriod.upsert({
      where: { year_half: { year, half: "MID" } },
      update: { isActive: true },
      create: { name: `Mid Year ${year}`, half: "MID", year, isActive: true },
    });
    console.log(`Activated period: ${period.name}`);
  }

  // 2. Demo employees if too few profiles to make a meaningful 360
  const profileCount = await prisma.feedbackProfile.count({ where: { active: true } });
  if (profileCount < 3) {
    const setting = await prisma.feedbackSetting.findUnique({ where: { id: "singleton" } });
    const levelTargets = (setting?.levelTargets as Record<string, number>) ?? {};
    const allComps = await prisma.competency.findMany();
    const password = await bcrypt.hash("demo1234", 10);
    const userIdByKey = new Map<string, string>();

    for (const [name, dept, position, level, isManager] of DEMO_EMPLOYEES) {
      const email = emailFor(name);
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { name, email, password, role: isManager ? "LEAD" : "MEMBER", division: dept },
      });
      userIdByKey.set(email.replace(DEMO_EMAIL_SUFFIX, ""), user.id);

      const compIds = allComps
        .filter(
          (c) =>
            c.active &&
            (c.category === "CORE" ||
              (c.category === "LEADERSHIP" && isManager) ||
              (c.category === "JOB_FAMILY" && c.department === dept) ||
              (c.category === "TECHNICAL" && c.department == null))
        )
        .map((c) => c.id);

      const profile = await prisma.feedbackProfile.upsert({
        where: { userId: user.id },
        update: { department: dept, position, level, targetLevel: levelTargets[level] ?? 2, isManager, active: true },
        create: { userId: user.id, department: dept, position, level, targetLevel: levelTargets[level] ?? 2, isManager, active: true },
      });
      await prisma.profileCompetency.deleteMany({ where: { profileId: profile.id } });
      await prisma.profileCompetency.createMany({
        data: compIds.map((competencyId) => ({ profileId: profile.id, competencyId })),
      });
    }
    // manager links (second pass)
    for (const [name, , , , , mgrKey] of DEMO_EMPLOYEES) {
      if (!mgrKey) continue;
      const uid = userIdByKey.get(emailFor(name).replace(DEMO_EMAIL_SUFFIX, ""))!;
      const mgrId = userIdByKey.get(mgrKey);
      if (mgrId) await prisma.feedbackProfile.update({ where: { userId: uid }, data: { managerId: mgrId } });
    }
    console.log(`Created ${DEMO_EMPLOYEES.length} demo employees (password: demo1234).`);
  }

  // 3. Build assignments (same rule as the app) and fill random submitted scores
  const profiles = await prisma.feedbackProfile.findMany({
    where: { active: true },
    include: { competencies: { select: { competencyId: true } }, user: { select: { id: true, name: true } } },
  });
  type P = (typeof profiles)[number];
  const compIdsOf = (p: P) => p.competencies.map((c) => c.competencyId);

  let n = 0;
  for (const rater of profiles) {
    for (const ratee of profiles) {
      let rel: string | null = null;
      if (ratee.userId === rater.userId) rel = "SELF";
      else if (rater.managerId && rater.managerId === ratee.userId) rel = "SUBORDINATE";
      else if (ratee.managerId && ratee.managerId === rater.userId) rel = "SUPERORDINATE";
      else if (rater.department && ratee.department && rater.department === ratee.department) rel = "PEER";
      if (!rel) continue;

      const target = ratee.targetLevel ?? 2;
      for (const competencyId of compIdsOf(ratee)) {
        // random score around the ratee's target, clamped 1..4 (same as the prototype)
        const score = Math.max(1, Math.min(4, Math.round(target + (Math.random() < 0.5 ? 0 : 1) - (Math.random() < 0.3 ? 1 : 0))));
        await prisma.feedbackResponse.upsert({
          where: {
            periodId_raterId_rateeId_competencyId: {
              periodId: period.id, raterId: rater.userId, rateeId: ratee.userId, competencyId,
            },
          },
          update: { score, submitted: true, relation: rel },
          create: { periodId: period.id, raterId: rater.userId, rateeId: ratee.userId, competencyId, relation: rel, score, submitted: true },
        });
        n++;
      }
    }
  }
  console.log(`Filled ${n} responses for "${period.name}" across ${profiles.length} employees.`);
  console.log("Open the app → Dashboard 360 / Report Recap to see the results.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
