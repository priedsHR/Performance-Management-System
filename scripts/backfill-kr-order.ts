import "dotenv/config"; import { prisma } from "@/lib/prisma";
async function main(){
  const objs = await prisma.objective.findMany({ select:{ id:true } });
  let n=0;
  for (const o of objs){
    const krs = await prisma.keyResult.findMany({ where:{ objectiveId:o.id }, orderBy:{ createdAt:"asc" }, select:{ id:true } });
    for (let i=0;i<krs.length;i++){ await prisma.keyResult.update({ where:{ id:krs[i].id }, data:{ sortOrder:i } }); n++; }
  }
  console.log(`backfilled ${n} KRs across ${objs.length} objectives`);
  await prisma.$disconnect();
}
main().catch(e=>{console.error("ERR",e.message);process.exit(1);});
