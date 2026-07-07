"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TeamMember360 {
  userId: string;
  name: string;
  position: string | null;
  department: string | null;
  selfSubmitted: boolean;
  raterCount: number;
  raterSubmitted: number;
}

interface PeriodInfo {
  id: string;
  name: string;
}

export default function LeadDashboard360() {
  const [data, setData] = useState<{ period: PeriodInfo | null; team: TeamMember360[] } | null>(null);

  useEffect(() => {
    fetch("/api/feedback/lead-team").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!data.period) return <p className="text-sm text-slate-400">No active period yet.</p>;
  if (data.team.length === 0)
    return <p className="text-sm text-slate-400">No team members registered in 360.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Period: <span className="font-semibold text-slate-700">{data.period.name}</span></p>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-400 text-xs">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Member</th>
              <th className="text-center px-3 py-2 font-semibold">Self-assessment</th>
              <th className="text-center px-3 py-2 font-semibold">Raters submitted</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.team.map((m) => (
              <tr key={m.userId} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-700">{m.name}</p>
                  <p className="text-[11px] text-slate-400">{m.position || "—"} · {m.department || "—"}</p>
                </td>
                <td className="px-3 py-2 text-center">
                  {m.selfSubmitted ? (
                    <span className="text-teal-600 font-semibold">Done</span>
                  ) : (
                    <span className="text-slate-400">Not yet</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-slate-600">
                  {m.raterSubmitted}/{m.raterCount}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/360/report?userId=${m.userId}`}
                    className="px-2 py-1 rounded text-xs text-teal-600 hover:bg-teal-50"
                  >
                    View report →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
