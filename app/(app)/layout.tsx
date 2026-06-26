import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SessionProvider from "@/components/SessionProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-slate-50">
        <div className="print:hidden"><Sidebar role={session.user.role} name={session.user.name} division={session.user.division} /></div>
        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
