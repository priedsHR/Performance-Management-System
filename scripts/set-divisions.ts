import "dotenv/config"; import { prisma } from "@/lib/prisma";
const MAP: Record<string,string[]> = {
  "HR": ["dwita@prieds.com","people@prieds.com"],
  "Finance": ["litatrilestari@prieds.com"],
  "Marketing": ["arman.alfathoni@prieds.com","annisa.dwiptr@prieds.com","hasiva@prieds.com","lutfiana@prieds.com"],
  "Partnership": ["firyal@prieds.com","zhira@prieds.com"],
  "Sales": ["fuad.hasan@prieds.com","debbymuthia@prieds.com"],
  "Tech-Product": ["reggi.prasetyo@prieds.com","reyraynaldi@prieds.com","richard.gunawan@prieds.com","reynayesha@prieds.com","hendralutfi@prieds.com"],
  "Tech-Project": ["julianto.yauwin@prieds.com","randy.tandian@prieds.com","deabagus@prieds.com"],
  "Executive": ["mark.gabriel@prieds.com","vanessa.geraldine@prieds.com"],
};
async function main(){
  let total=0;
  for (const [div, emails] of Object.entries(MAP)){
    const r = await prisma.user.updateMany({ where:{ email:{ in: emails } }, data:{ division: div } });
    console.log(`  ${div.padEnd(14)} -> ${r.count} users`);
    total+=r.count;
  }
  console.log(`total updated ${total}`);
  const left = await prisma.user.findMany({ where:{ division:{ notIn:[...Object.keys(MAP)] } }, select:{name:true,division:true,email:true} });
  console.log("unmapped:", left.map(u=>`${u.name}(${u.division})`).join(", ") || "none");
  await prisma.$disconnect();
}
main().catch(e=>{console.error("ERR",e.message);process.exit(1);});
