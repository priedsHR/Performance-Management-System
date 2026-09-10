import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SessionProvider from "@/components/SessionProvider";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const name = session.user.name ?? "User";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = session.user.role === "ADMIN" ? "Admin" : session.user.role === "LEAD" ? "Division Lead" : "Member";

  return (
    <SessionProvider>
      <AppShell
        role={session.user.role}
        name={session.user.name ?? null}
        division={session.user.division ?? null}
        roleLabel={roleLabel}
        initials={initials}
        isExecutive={session.user.isExecutive}
      >
        {children}
      </AppShell>
    </SessionProvider>
  );
}
