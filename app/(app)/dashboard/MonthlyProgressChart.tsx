"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Point { month: string; achievement: number; quarter: string }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: string) => {
  const [y, mo] = m.split("-");
  return `${MONTHS[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
};

// Monthly OKR achievement line for one employee (self view by default).
export default function MonthlyProgressChart({ memberId }: { memberId?: string }) {
  const [series, setSeries] = useState<Point[] | null>(null);
  const [linked, setLinked] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/monthly${memberId ? `?memberId=${memberId}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setSeries(d.series || []); setLinked(d.linked !== false); });
  }, [memberId]);

  if (series === null) return <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-40" />;
  if (!linked) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-slate-800">Monthly OKR Progress</p>
        <span className="text-[11px] text-slate-400">achievement % per month</span>
      </div>
      {series.length === 0 ? (
        <p className="text-sm text-slate-400">No monthly data yet — progress is recorded automatically each month as you update your OKRs.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series.map((s) => ({ ...s, name: label(s.month) }))} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip formatter={(v) => [`${v}%`, "Achievement"]} labelFormatter={(l, p) => `${l}${p?.[0]?.payload?.quarter ? ` · ${p[0].payload.quarter}` : ""}`} />
            <Line type="monotone" dataKey="achievement" stroke="#097eb9" strokeWidth={2.5} dot={{ r: 3.5, fill: "#49c5e9" }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
