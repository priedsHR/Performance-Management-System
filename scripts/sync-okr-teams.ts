import "dotenv/config";
import { prisma } from "@/lib/prisma";

// Sync the OKR team structure (TeamMember.leadId) from the 360 manager
// relationships (FeedbackProfile.managerId), which are the source of truth for
// who reports to whom. TeamMember.userId is unique, so each person is exactly
// one team member under one lead. Existing assignments are preserved — we only
// create missing links and correct the leadId/name on existing ones.
async function main() {
  const dry = process.argv.includes("--dry");
  const profiles = await prisma.feedbackProfile.findMany({
    where: { active: true },
    include: { user: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } } },
  });

  let created = 0, moved = 0, unchanged = 0, skipped = 0;
  for (const p of profiles) {
    if (!p.manager) { skipped++; continue; }
    const existing = await prisma.teamMember.findUnique({ where: { userId: p.user.id } });
    if (!existing) {
      console.log(`  + CREATE  ${p.user.name}  ->  lead ${p.manager.name}`);
      if (!dry) await prisma.teamMember.create({ data: { name: p.user.name!, leadId: p.manager.id, userId: p.user.id } });
      created++;
    } else if (existing.leadId !== p.manager.id) {
      console.log(`  ~ MOVE    ${p.user.name}  ->  lead ${p.manager.name}`);
      if (!dry) await prisma.teamMember.update({ where: { id: existing.id }, data: { leadId: p.manager.id, name: p.user.name! } });
      moved++;
    } else {
      unchanged++;
    }
  }
  console.log(`\n${dry ? "[DRY RUN] " : ""}created=${created} moved=${moved} unchanged=${unchanged} noManager=${skipped}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
