"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import PriedsLogo from "@/components/PriedsLogo";

// Responsive shell: fixed sidebar on desktop; on mobile the sidebar is a
// slide-in drawer opened from a hamburger in the top bar and auto-closes on navigation.
export default function AppShell({
  role, name, division, roleLabel, initials, children,
}: {
  role: string; name: string | null; division: string | null;
  roleLabel: string; initials: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]); // close drawer after navigating

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block print:hidden">
        <Sidebar role={role} name={name} division={division} />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 overflow-y-auto shadow-2xl">
            <Sidebar role={role} name={name} division={division} onNavigate={() => setOpen(false)} />
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute left-[15rem] top-3 bg-white rounded-lg p-2 shadow text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="print:hidden bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="lg:hidden text-slate-600 hover:text-slate-900 p-1 -ml-1"
            >
              <Menu size={22} />
            </button>
            <PriedsLogo size="sm" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-right leading-tight hidden sm:block">
              <p className="text-xs font-semibold text-slate-800">{name}</p>
              <p className="text-[11px] text-slate-400">{roleLabel}{division ? ` · ${division}` : ""}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#d9f2fb] flex items-center justify-center text-[#097eb9] font-bold text-xs">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
