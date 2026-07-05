"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const bandClass: Record<string, string> = {
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
  teal: "bg-teal-50 text-teal-700",
  green: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-500",
};

interface Period { id: string; name: string; year: number; half: string; releaseReports: boolean }
interface Cat { category: string; label: string; score: number | null }
interface Payload {
  report: { overall: number | null; overallBand: { label: string; color: string }; targetLevel: number | null; hasData: boolean; categories: Cat[] };
  period: { name: string };
}

// Compact "My 360 Performance" card for the employee dashboard: latest
// released period's overall score, band and category bars.
export default function My360Card({ userId }: { userId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "none" | "ready">("loading");

  useEffect(() => {
    (async () => {
      try {
        const periods: Period[] = await fetch("/api/feedback/periods").then((r) => r.json());
        const released = (periods || []).filter((p) => p.releaseReports);
        if (!released.length) { setState("none"); return; }
        const latest = released[0]; // API returns newest first
        const r = await fetch(`/api/feedback/report?userId=${userId}&periodId=${latest.id}`);
        if (!r.ok) { setState("none"); return; }
        const d = await r.json();
        if (!d?.report?.hasData) { setState("none"); return; }
        setData(d);
        setState("ready");
      } catch {
        setState("none");
      }
    })();
  }, [userId]);

  if (state === "loading")
    return <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-28" />;

  if (state === "none")
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-sm font-bold text-slate-800">📝 My 360 Performance</p>
        <p className="text-sm text-slate-400 mt-1">No released 360 report yet. Your score will appear here once HR releases the reports.</p>
        <Link href="/360" className="text-sm font-semibold text-teal-700 hover:underline mt-2 inline-block">Go to 360° Feedback →</Link>
      </div>
    );

  const { report, period } = data!;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-sm font-bold text-slate-800">📝 My 360 Performance <span className="font-normal text-slate-400">· {period.name}</span></p>
        <Link href="/360/report" className="text-xs font-semibold text-teal-700 hover:underline">Full report →</Link>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-teal-700">{report.overall == null ? "—" : report.overall.toFixed(2)}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${bandClass[report.overallBand.color] || bandClass.slate}`}>{report.overallBand.label}</span>
          {report.targetLevel && <span className="text-xs text-slate-400">target L{report.targetLevel}</span>}
        </div>
        <div className="flex-1 min-w-[220px] grid gap-1">
          {report.categories.filter((c) => c.score != null).map((c) => (
            <div key={c.category} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-20 truncate">{c.label}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: `${((c.score as number) / 4) * 100}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-teal-700 w-8 text-right">{(c.score as number).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
