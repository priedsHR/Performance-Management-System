"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Target, MessageSquareText, TrendingUp, Grid3x3, Sprout, CalendarClock,
  Bell, Puzzle, CalendarDays, FileText, SlidersHorizontal, Users,
  LayoutDashboard, UserSquare2, LogOut, type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

const adminDashboard: Item[] = [
  { href: "/dashboard", label: "OKR", icon: Target },
  { href: "/360", label: "360 Feedback", icon: MessageSquareText },
  { href: "/northstar", label: "North Star", icon: TrendingUp },
  { href: "/admin/ninebox", label: "9-Box Matrix", icon: Grid3x3 },
  { href: "/idp", label: "IDP", icon: Sprout },
];
const adminSettingOkr: Item[] = [
  { href: "/admin/quarters", label: "Quarter", icon: CalendarClock },
  { href: "/admin/reminders", label: "Reminder", icon: Bell },
];
const adminSetting360: Item[] = [
  { href: "/360/admin/competencies", label: "Competencies", icon: Puzzle },
  { href: "/360/admin/periods", label: "Periods", icon: CalendarDays },
  { href: "/360/admin/reports", label: "Report Recap", icon: FileText },
  { href: "/360/admin/settings", label: "Weighting", icon: SlidersHorizontal },
  { href: "/360/admin/reminders", label: "Reminder", icon: Bell },
];
const adminGeneralSetting: Item[] = [
  { href: "/admin/employees", label: "Employee Management", icon: UserSquare2 },
];

const leadDashboard: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/northstar", label: "North Star", icon: TrendingUp },
];
const leadOkr: Item[] = [
  { href: "/okr", label: "Division OKR", icon: Target },
  { href: "/distribusi", label: "Member Distribution", icon: Users },
];
const lead360: Item[] = [
  { href: "/360", label: "360° Feedback", icon: MessageSquareText },
  { href: "/360/report", label: "My Report", icon: FileText },
  { href: "/idp", label: "My IDP", icon: Sprout },
];

const memberDashboard: Item[] = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];
const member360: Item[] = [
  { href: "/360", label: "360° Feedback", icon: MessageSquareText },
  { href: "/360/report", label: "My Report", icon: FileText },
  { href: "/idp", label: "My IDP", icon: Sprout },
];

export default function Sidebar({ role, name, division }: { role: string; name?: string | null; division?: string | null }) {
  const path = usePathname();

  const roleLabel = role === "ADMIN" ? "Admin" : role === "LEAD" ? "Division Lead" : "Member";
  const initials = name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "U";

  function NavLink({ href, label, icon: Icon }: Item) {
    const active = href === "/360" ? path === "/360" : path.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100 ${
          active
            ? "bg-[#eef9fd] text-[#097eb9] border border-[#b7e7f7]"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
        }`}
      >
        <Icon size={16} strokeWidth={2} className={active ? "text-[#097eb9]" : "text-slate-400"} />
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
        <div>
          <h1 className="text-slate-900 font-bold text-sm leading-tight tracking-tight">
            <span className="text-[#097eb9]">PRIEDS</span> Performance
          </h1>
          <p className="text-slate-400 text-xs leading-tight mt-0.5">Management System{division ? ` · ${division}` : ""}</p>
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
          <div className="w-7 h-7 rounded-full bg-[#d9f2fb] flex items-center justify-center text-[#097eb9] font-bold text-xs flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-slate-800 text-xs font-semibold truncate">{name}</p>
            <p className="text-slate-400 text-xs">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 w-full transition-colors duration-100"
        >
          <LogOut size={15} className="text-slate-400" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
