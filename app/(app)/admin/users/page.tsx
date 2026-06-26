import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UserManager from "./UserManager";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, division: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const teamMembers = await prisma.teamMember.findMany({
    select: { id: true, name: true, leadId: true, userId: true, lead: { select: { division: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Manajemen Pengguna</h1>
      <UserManager
        initialUsers={JSON.parse(JSON.stringify(users))}
        teamMembers={JSON.parse(JSON.stringify(teamMembers))}
      />
    </div>
  );
}
