// One-off import of the PRIEDS employee list (from HR xlsx) into users + 360 profiles.
//   npx tsx prisma/importEmployees.ts
// Existing users (matched by email) are updated, not duplicated. Default password
// for new accounts: Prieds2026! (ask employees to change it after first login).
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "Prieds2026!";

// org (xlsx) → competency-library department
const DEPT_MAP: Record<string, string> = {
  "Tech & Product": "Tech",
  Commercial: "Commercial",
  Sales: "Commercial",
  "Creative & Marketing": "Commercial",
  Operation: "Operations",
  "People & Culture": "Operations",
  PRIEDS: "Executive",
};

// [name, org, position, level, email, managerEmail, isManager, techCodes]
const EMPLOYEES: [string, string, string, string, string, string | null, boolean, string[]][] = [
  ["Mark Gabriel Priyono", "PRIEDS", "CEO", "Direktur", "mark.gabriel@prieds.com", null, true, ["AIF"]],
  ["Julianto Yauwin", "Tech & Product", "CTO", "C-Suites", "julianto.yauwin@prieds.com", "mark.gabriel@prieds.com", true, ["AIF"]],
  ["Vanessa Geraldine", "Commercial", "CCO", "C-Suites", "vanessa.geraldine@prieds.com", "mark.gabriel@prieds.com", true, ["AIF"]],
  ["Reggi Prasetyo Kurniawan", "Tech & Product", "CPO", "C-Suites", "reggi.prasetyo@prieds.com", "mark.gabriel@prieds.com", true, ["AIF", "PSA"]],
  ["Annisa Dwi Putri", "Creative & Marketing", "Graphic Designer", "Officer", "annisa.dwiptr@prieds.com", "vanessa.geraldine@prieds.com", false, ["AIF", "VCO"]],
  ["Richard Gunawan", "Tech & Product", "Full Stack Developer", "Sr Officer", "richard.gunawan@prieds.com", "reggi.prasetyo@prieds.com", false, ["AIF", "FEL", "BSA", "DBM", "QAT", "DBG"]],
  ["Randy Tandian", "Tech & Product", "Project Manager", "Manager", "randy.tandian@prieds.com", "julianto.yauwin@prieds.com", true, ["AIF", "PPS", "PGV", "QAT", "DBG"]],
  ["Reyner Raynaldi Indarto", "Tech & Product", "Associate Product Manager", "Manager", "reyraynaldi@prieds.com", "reggi.prasetyo@prieds.com", true, ["AIF", "UXD", "PDV", "POP", "PSA", "PPS"]],
  ["Arman Alfathoni", "Commercial", "Digital Marketing Manager", "Manager", "arman.alfathoni@prieds.com", "vanessa.geraldine@prieds.com", true, ["AIF", "CSP", "CPS", "DCM", "DPE", "MKI", "MDA", "PSM", "SEO", "SCS", "VCO"]],
  ["Hendra Mahasinul Lutfi", "Tech & Product", "UI/UX Designer", "Officer", "hendralutfi@prieds.com", "reggi.prasetyo@prieds.com", false, ["AIF", "UXD", "UID"]],
  ["Reyna Ayesha Putri", "Tech & Product", "Product Designer", "Sr Officer", "reynayesha@prieds.com", "reggi.prasetyo@prieds.com", false, ["AIF", "UXD", "UID", "DAR", "PDV"]],
  ["Fuad Hasan", "Sales", "Lead of Account Manager", "Leader", "fuad.hasan@prieds.com", "mark.gabriel@prieds.com", true, ["AIF", "CLC", "CSP", "CSL", "DPE", "MKI", "PSM", "RM", "SNG"]],
  ["Kevin Ramadhani Dinamika", "Commercial", "SEO Specialist", "Part Time", "kev.ramadhani@prieds.com", "arman.alfathoni@prieds.com", false, ["AIF", "MDA", "SEO", "SCS"]],
  ["Lutfiana Arifah", "Commercial", "Jr Digital Marketing Specialist", "Officer", "lutfiana@prieds.com", "arman.alfathoni@prieds.com", false, ["AIF", "CPS", "DCM", "SCS"]],
  ["Dea Bagus Sulaeman", "Tech & Product", "Full Stack Developer", "Officer", "deabagus@prieds.com", "julianto.yauwin@prieds.com", false, ["AIF", "FEL", "BSA", "DBM", "QAT", "DBG"]],
  ["Firyal Tharifa", "Commercial", "Partnership Executive", "Sr Officer", "firyal@prieds.com", "vanessa.geraldine@prieds.com", true, ["AIF", "CLC", "CSP", "CSL", "DPE", "MKI", "PSM", "RM", "SNG"]],
  ["Lita Tri Lestari", "Operation", "Finance Manager", "Manager", "litatrilestari@prieds.com", "mark.gabriel@prieds.com", true, ["AIF", "SFP", "FMD", "TCC", "FGA", "TAX"]],
  ["Hasiva Amalia Dewi", "Commercial", "Content Marketing", "Internship", "hasiva@prieds.com", "arman.alfathoni@prieds.com", false, ["AIF", "CPS", "SCS", "VCO", "PSM"]],
  ["Dwita Maulani Setyo Prasojo", "Operation", "People & Culture Manager", "Manager", "dwita@prieds.com", "mark.gabriel@prieds.com", true, ["AIF", "HRG", "PSME", "ORGD", "REC", "REM"]],
  ["Debby Muthia", "Sales", "Jr Account Manager", "Officer", "debbymuthia@prieds.com", "fuad.hasan@prieds.com", false, ["AIF", "CSP", "CSL", "DPE", "PSM", "RM"]],
  ["Tievanto Yasser Alfatah", "People & Culture", "People Engagement & Culture", "Part Time", "people@prieds.com", "dwita@prieds.com", false, ["AIF", "PSME", "ORGD"]],
  ["Zhira Rizkiany Fauzyah", "Commercial", "Partnership Intern", "Internship", "zhira@prieds.com", "firyal@prieds.com", false, ["AIF", "DPE", "RM"]],
];

async function main() {
  // clean demo employees from earlier trials
  const demo = await prisma.user.deleteMany({ where: { email: { endsWith: "@demo360.local" } } });
  if (demo.count) console.log(`Removed ${demo.count} demo employees.`);

  const setting = await prisma.feedbackSetting.findUnique({ where: { id: "singleton" } });
  const levelTargets = (setting?.levelTargets as Record<string, number>) ?? {};
  const allComps = await prisma.competency.findMany();
  const compByCode = new Map(allComps.map((c) => [c.code, c]));
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const userIdByEmail = new Map<string, string>();
  let created = 0, updated = 0;

  for (const [name, org, position, level, email, , isManager, tech] of EMPLOYEES) {
    const dept = DEPT_MAP[org] ?? org;
    const role = email === "dwita@prieds.com" ? "ADMIN" : isManager ? "LEAD" : "MEMBER";
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { name, email, password, role, division: dept } });
      created++;
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { name, role, division: dept } });
      updated++;
    }
    userIdByEmail.set(email, user.id);

    const compIds = new Set<string>();
    for (const c of allComps) {
      if (!c.active) continue;
      if (c.category === "CORE") compIds.add(c.id);
      else if (c.category === "LEADERSHIP" && isManager) compIds.add(c.id);
      else if (c.category === "JOB_FAMILY" && c.department === dept) compIds.add(c.id);
    }
    for (const code of tech) {
      const c = compByCode.get(code);
      if (c) compIds.add(c.id);
    }

    const profile = await prisma.feedbackProfile.upsert({
      where: { userId: user.id },
      update: { department: dept, position, level, targetLevel: levelTargets[level] ?? 1, isManager, active: true },
      create: { userId: user.id, department: dept, position, level, targetLevel: levelTargets[level] ?? 1, isManager, active: true },
    });
    await prisma.profileCompetency.deleteMany({ where: { profileId: profile.id } });
    await prisma.profileCompetency.createMany({
      data: [...compIds].map((competencyId) => ({ profileId: profile.id, competencyId })),
    });
  }

  // second pass: manager links
  for (const [, , , , email, managerEmail] of EMPLOYEES) {
    const uid = userIdByEmail.get(email)!;
    const mgrId = managerEmail ? userIdByEmail.get(managerEmail) ?? null : null;
    await prisma.feedbackProfile.update({ where: { userId: uid }, data: { managerId: mgrId } });
  }

  console.log(`Done: ${created} created, ${updated} updated (${EMPLOYEES.length} employees total).`);
  console.log(`Default password for new accounts: ${DEFAULT_PASSWORD}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
