"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type Item = { href: string; label: string; icon: string };

const adminDashboard: Item[] = [
  { href: "/dashboard", label: "OKR", icon: "🎯" },
  { href: "/360", label: "360 Feedback", icon: "📝" },
  { href: "/admin/ninebox", label: "9-Box Matrix", icon: "🧭" },
  { href: "/idp", label: "IDP", icon: "🌱" },
];
const adminSettingOkr: Item[] = [
  { href: "/admin/quarters", label: "Quarter", icon: "⏱️" },
  { href: "/admin/reminders", label: "Reminder", icon: "🔔" },
];
const adminSetting360: Item[] = [
  { href: "/360/admin/competencies", label: "Competencies", icon: "🧩" },
  { href: "/360/admin/periods", label: "Periods", icon: "🗓️" },
  { href: "/360/admin/reports", label: "Report Recap", icon: "📄" },
  { href: "/360/admin/settings", label: "Weighting", icon: "⚖️" },
  { href: "/360/admin/reminders", label: "Reminder", icon: "🔔" },
];
const adminGeneralSetting: Item[] = [
  { href: "/admin/employees", label: "Employee Management", icon: "🧑‍💼" },
];

const leadDashboard: Item[] = [{ href: "/dashboard", label: "Dashboard", icon: "📊" }];
const leadOkr: Item[] = [
  { href: "/okr", label: "Division OKR", icon: "🎯" },
  { href: "/distribusi", label: "Member Distribution", icon: "👥" },
];
const lead360: Item[] = [
  { href: "/360", label: "360° Feedback", icon: "📝" },
  { href: "/360/report", label: "My Report", icon: "📄" },
  { href: "/idp", label: "My IDP", icon: "🌱" },
];

const memberDashboard: Item[] = [{ href: "/dashboard", label: "Dashboard", icon: "📊" }];
const member360: Item[] = [
  { href: "/360", label: "360° Feedback", icon: "📝" },
  { href: "/360/report", label: "My Report", icon: "📄" },
  { href: "/idp", label: "My IDP", icon: "🌱" },
];

export default function Sidebar({ role, name, division }: { role: string; name?: string | null; division?: string | null }) {
  const path = usePathname();

  const roleLabel = role === "ADMIN" ? "Admin" : role === "LEAD" ? "Division Lead" : "Member";
  const initials = name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "U";

  function NavLink({ href, label, icon }: Item) {
    const active = href === "/360" ? path === "/360" : path.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100 ${
          active
            ? "bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1.5px_#fcd34d]"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <span className="text-base leading-none">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  }

  function GroupLabel({ children }: { children: React.ReactNode }) {
    return (
      <p className="text-slate-400 text-xs uppercase font-semibold tracking-wider px-3 mt-5 mb-2 first:mt-0">
        {children}
      </p>
    );
  }

  function NavGroup({ label, items }: { label: string; items: Item[] }) {
    return (
      <>
        <GroupLabel>{label}</GroupLabel>
        <div className="space-y-0.5">
          {items.map((item) => <NavLink key={item.href} {...item} />)}
        </div>
      </>
    );
  }

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <div>
            <h1 className="text-slate-900 font-bold text-sm leading-tight">Performance Management System</h1>
            {division && <p className="text-slate-400 text-xs leading-tight mt-0.5">{division}</p>}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {role === "ADMIN" && (
          <>
            <NavGroup label="Dashboard" items={adminDashboard} />
            <NavGroup label="Setting OKR" items={adminSettingOkr} />
            <NavGroup label="Setting 360 Feedback" items={adminSetting360} />
            <NavGroup label="General Setting" items={adminGeneralSetting} />
          </>
        )}
        {role === "LEAD" && (
          <>
            <NavGroup label="Dashboard" items={leadDashboard} />
            <NavGroup label="OKR" items={leadOkr} />
            <NavGroup label="360 Feedback" items={lead360} />
          </>
        )}
        {role === "MEMBER" && (
          <>
            <NavGroup label="Dashboard" items={memberDashboard} />
            <NavGroup label="360 Feedback" items={member360} />
          </>
        )}
      </nav>

      <div className="px-3 pb-4 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-slate-800 text-xs font-semibold truncate">{name}</p>
            <p className="text-slate-400 text-xs">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 w-full transition-all duration-100"
        >
          <span>🚪</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
