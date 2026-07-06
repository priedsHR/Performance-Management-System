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

interface Period {
  id: string;
  name: string;
  isActive: boolean;
}
interface Row {
  userId: string;
  name: string;
  department: string | null;
  position: string | null;
  targetLevel: number | null;
  overall: number | null;
  band: { label: string; color: string };
  responseCount: number;
  hasData: boolean;
}

export default function ReportsAdmin() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "dept" | "scoreDesc" | "scoreAsc">("scoreDesc");

  useEffect(() => {
    fetch("/api/feedback/periods")
      .then((r) => r.json())
      .then((ps: Period[]) => {
        setPeriods(ps);
        const active = ps.find((p) => p.isActive) || ps[0];
        if (active) setPeriodId(active.id);
      });
  }, []);

  useEffect(() => {
    if (!periodId) return;
    setLoading(true);
    fetch(`/api/feedback/report?all=1&periodId=${periodId}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []))
      .finally(() => setLoading(false));
  }, [periodId]);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">🗓️ Select Period</label>
        <select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white w-full max-w-xs"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.isActive ? " (Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* search / filter / sort */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search name / position…"
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm flex-1 min-w-[200px] bg-white" />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
          <option value="">All departments</option>
          {[...new Set(rows.map((r) => r.department).filter(Boolean))].sort().map((d) => (
            <option key={d as string} value={d as string}>{d}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "dept" | "scoreDesc" | "scoreAsc")} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
          <option value="scoreDesc">Sort: Score high → low</option>
          <option value="scoreAsc">Sort: Score low → high</option>
          <option value="name">Sort: Name A-Z</option>
          <option value="dept">Sort: Department</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/4" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-20" />
                <div className="h-6 bg-slate-100 rounded-lg w-16" />
                <div className="h-3 bg-slate-100 rounded w-8" />
                <div className="h-3 bg-amber-100 rounded w-12" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-slate-500 text-sm">No assessment data for this period yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-2.5 font-semibold">Name</th>
                <th className="text-left px-3 py-2.5 font-semibold">Department</th>
                <th className="text-center px-3 py-2.5 font-semibold">Score</th>
                <th className="text-left px-3 py-2.5 font-semibold">Band</th>
                <th className="text-center px-3 py-2.5 font-semibold">Responses</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => !deptFilter || r.department === deptFilter)
                .filter((r) => {
                  const t = q.trim().toLowerCase();
                  if (!t) return true;
                  return [r.name, r.position, r.department].some((v) => (v || "").toLowerCase().includes(t));
                })
                .sort((a, b) =>
                  sortBy === "name" ? a.name.localeCompare(b.name)
                  : sortBy === "dept" ? (a.department || "").localeCompare(b.department || "") || a.name.localeCompare(b.name)
                  : sortBy === "scoreAsc" ? (a.overall ?? 99) - (b.overall ?? 99)
                  : (b.overall ?? -1) - (a.overall ?? -1)
                )
                .map((r) => (
                <tr key={r.userId} className="border-t border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{r.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{r.position || "—"}{r.targetLevel ? ` · target L${r.targetLevel}` : ""}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs">{r.department || "—"}</td>
                  <td className="px-3 py-3 text-center font-bold text-amber-700">{r.overall == null ? "—" : r.overall.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${bandClass[r.band.color] || bandClass.slate}`}>{r.band.label}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400 text-xs">{r.responseCount}</td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/360/report?userId=${r.userId}&periodId=${periodId}`}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
