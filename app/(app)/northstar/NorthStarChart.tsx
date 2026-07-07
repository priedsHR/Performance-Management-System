"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PALETTE = ["#49c5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#ec4899", "#64748b", "#84cc16"];

export default function NorthStarChart() {
  const [data, setData] = useState<{ points: Record<string, string | number | null>[]; divisions: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/northstar").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse h-80" />;
  if (!data.points.length)
    return <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-400">No OKR data yet. The chart appears once objectives exist in at least one quarter.</div>;

  const latest = data.points[data.points.length - 1];

  return (
    <div className="space-y-4">
      {/* headline numbers for the latest quarter */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <div className="bg-[#097eb9] text-white rounded-2xl p-4">
          <p className="text-[11px] opacity-80">Company · {String(latest.quarter)}</p>
          <p className="text-2xl font-extrabold mt-0.5">{latest.Company ?? "—"}%</p>
        </div>
        {data.divisions.map((d, i) => (
          <div key={d} className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[11px] text-slate-400 truncate">{d}</p>
            <p className="text-2xl font-extrabold mt-0.5" style={{ color: PALETTE[i % PALETTE.length] }}>
              {latest[d] != null ? `${latest[d]}%` : "—"}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 print:border-0">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <p className="text-sm font-bold text-slate-800">Quarterly achievement — divisions & company</p>
          <button onClick={() => window.print()} className="text-xs font-semibold text-teal-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
            Print / PDF
          </button>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={data.points} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#94a3b8" }} unit="%" />
            <Tooltip formatter={(v) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {data.divisions.map((d, i) => (
              <Line key={d} type="monotone" dataKey={d} stroke={PALETTE[i % PALETTE.length]} strokeWidth={1.6} dot={{ r: 3 }} strokeOpacity={0.75} />
            ))}
            <Line type="monotone" dataKey="Company" stroke="#0f172a" strokeWidth={3.2} dot={{ r: 4.5, fill: "#097eb9" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
