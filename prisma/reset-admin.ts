import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("admin123", 10);
  const u = await prisma.user.update({
    where: { email: "admin@okr.com" },
    data: { password: hash },
  });
  console.log("Password berhasil diupdate:", u.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
