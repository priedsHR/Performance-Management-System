import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@okr.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@okr.com",
      password,
      role: "ADMIN",
    },
  });
  console.log("Seed selesai. Admin akun dibuat:", admin.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
