import "dotenv/config"; import { prisma } from "@/lib/prisma";
// C-Level who can view all departments' OKR.
const EXEC_EMAILS = [
  "reggi.prasetyo@prieds.com",
  "vanessa.geraldine@prieds.com",
  "mark.gabriel@prieds.com",
  "julianto.yauwin@prieds.com",
];
async function main(){
  const r = await prisma.user.updateMany({ where:{ email:{ in: EXEC_EMAILS } }, data:{ isExecutive: true } });
  const execs = await prisma.user.findMany({ where:{ isExecutive:true }, select:{ name:true, email:true, role:true }});
  console.log(`Updated ${r.count}. Executives now:`);
  for (const e of execs) console.log(`  ${e.role.padEnd(6)} | ${e.name} | ${e.email}`);
  await prisma.$disconnect();
}
main().catch(e=>{console.error("ERR",e.message);process.exit(1);});
