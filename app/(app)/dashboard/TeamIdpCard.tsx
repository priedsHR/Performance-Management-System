"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Plan { userId: string; userName: string; position: string | null; status: string; updatedAt: string }
interface TeamMember { userId: string; name: string; position: string | null }

// Manager dashboard card: IDP status of direct reports for the current semester.
export default function TeamIdpCard() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [periodName, setPeriodName] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/idp?list=1").then((r) => r.json()).catch(() => ({ plans: [] })),
      fetch("/api/feedback/lead-team").then((r) => r.json()).catch(() => ({ team: [] })),
    ]).then(([idp, lt]) => {
      setPlans(idp.plans || []);
      setPeriodName(idp.period?.name || "");
      setTeam(lt.team || []);
    });
  }, []);

  if (plans === null) return <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-24" />;

  const planByUser = new Map(plans.map((p) => [p.userId, p]));
  const rows = team.map((m) => ({
    userId: m.userId,
    name: m.name,
    position: m.position,
    status: planByUser.get(m.userId)?.status ?? "NONE",
  }));
  // include plans from reports not in the 360 team list (edge case)
  for (const p of plans) if (!rows.some((r) => r.userId === p.userId)) rows.push({ userId: p.userId, name: p.userName, position: p.position, status: p.status });

  const submitted = rows.filter((r) => r.status === "SUBMITTED").length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-sm font-bold text-slate-800">
          Team IDP {periodName && <span className="font-normal text-slate-400">· {periodName}</span>}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500"><span className="font-bold text-[#097eb9]">{submitted}</span> / {rows.length} submitted</span>
          <Link href="/idp" className="text-xs font-semibold text-[#097eb9] hover:underline">Review plans →</Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No team members registered yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span
              key={r.userId}
              title={r.position || ""}
              className={`text-[11px] font-semibold px-2 py-1 rounded-lg border ${
                r.status === "SUBMITTED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : r.status === "DRAFT"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-50 text-slate-400 border-slate-200"
              }`}
            >
              {r.name.split(" ").slice(0, 2).join(" ")} · {r.status === "SUBMITTED" ? "Submitted" : r.status === "DRAFT" ? "Draft" : "Not started"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
