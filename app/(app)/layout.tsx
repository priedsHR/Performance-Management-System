import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SessionProvider from "@/components/SessionProvider";
import PriedsLogo from "@/components/PriedsLogo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const name = session.user.name ?? "User";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = session.user.role === "ADMIN" ? "Admin" : session.user.role === "LEAD" ? "Division Lead" : "Member";

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-slate-50">
        <div className="print:hidden"><Sidebar role={session.user.role} name={session.user.name} division={session.user.division} /></div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="print:hidden bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between sticky top-0 z-20">
            <PriedsLogo size="sm" />
            <div className="flex items-center gap-2.5">
              <div className="text-right leading-tight hidden sm:block">
                <p className="text-xs font-semibold text-slate-800">{name}</p>
                <p className="text-[11px] text-slate-400">{roleLabel}{session.user.division ? ` · ${session.user.division}` : ""}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#d9f2fb] flex items-center justify-center text-[#097eb9] font-bold text-xs">
                {initials}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
