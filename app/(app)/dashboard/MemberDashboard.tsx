"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { calcObjectiveAchievement, calcUserAchievement } from "@/lib/calculations";
import YearQuarterPicker from "@/components/YearQuarterPicker";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

type KR = {
  id: string; title: string; target: number; unit: string; weight: number;
  teamProgress: number; leadProgress: number | null;
};
type Objective = {
  id: string; title: string; weight: number; status: string; keyResults: KR[];
};

type Props = {
  quarters: { id: string; name: string; year: number; quarter: number; isActive: boolean }[];
  userId: string;
  initialObjectives: Objective[];
  initialQuarterId: string;
};

function achClass(v: number) {
  return v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
}
function achEmoji(v: number) { return v >= 100 ? "" : v >= 70 ? "" : ""; }

function ProgressBar({ value, size = "sm" }: { value: number; size?: "xs" | "sm" }) {
  const h = size === "xs" ? "h-1" : "h-1.5";
  const bg = value >= 100 ? "bg-green-500" : value >= 70 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className={`${h} bg-slate-100 rounded-full overflow-hidden`}>
      <div className={`${h} ${bg} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function ObjectiveCard({ obj, oa, index }: { obj: Objective; oa: number; index: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0"></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-600 mb-0.5">Objective #{index + 1}</p>
            <h3 className="font-bold text-slate-800 text-sm leading-snug">{obj.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">Weight {obj.weight}%</span>
              {obj.status === "SUBMITTED"
                ? <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Submitted</span>
                : <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-2 py-0.5 rounded-full">Draft</span>
              }
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${achClass(oa)}`}>
            {achEmoji(oa)} {oa.toFixed(1)}%
          </span>
          <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {open && (
        <>
          <div className="px-5 py-2 border-t border-slate-100">
            <ProgressBar value={oa} size="xs" />
          </div>
          <div className="p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Key Results</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-slate-400">Key Result</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Target</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Unit</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Weight</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Progress</th>
                  <th className="text-right py-2 pl-2 text-xs font-semibold text-slate-400">Achievement</th>
                </tr>
              </thead>
              <tbody>
                {obj.keyResults.map((kr) => {
                  const progress = kr.teamProgress + (kr.leadProgress ?? 0);
                  const pct = kr.target > 0 ? Math.min((progress / kr.target) * 100, 100) : 0;
                  return (
                    <tr key={kr.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">
                        <span className="block">{kr.title}</span>
                        {kr.leadProgress != null && kr.leadProgress > 0 && <span className="text-xs text-blue-500">lead: {kr.leadProgress}</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600 tabular-nums">{kr.target}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{kr.unit}</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-600">{kr.weight}%</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">{progress} / {kr.target}</td>
                      <td className="py-2.5 pl-2 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${achClass(pct)}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function MemberDashboard({ quarters, userId, initialObjectives, initialQuarterId }: Props) {
  const [selectedQ, setSelectedQ] = useState(initialQuarterId);
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState<{ name: string; achievement: number }[]>([]);

  // Fetch objectives when quarter changes
  useEffect(() => {
    if (!selectedQ || selectedQ === initialQuarterId) return;
    setLoading(true);
    fetch(`/api/objectives?userId=${userId}&quarterId=${selectedQ}`)
      .then((r) => r.json())
      .then((d) => { setObjectives(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedQ, userId, initialQuarterId]);

  // Build trend from all quarters data
  useEffect(() => {
    async function loadTrend() {
      const points: { name: string; achievement: number }[] = [];
      for (const q of [...quarters].reverse()) {
        try {
          const res = await fetch(`/api/objectives?userId=${userId}&quarterId=${q.id}`);
          const objs: Objective[] = await res.json();
          if (Array.isArray(objs) && objs.length > 0) {
            const ach = calcUserAchievement(objs as Parameters<typeof calcUserAchievement>[0]);
            points.push({ name: q.name, achievement: parseFloat(ach.toFixed(1)) });
          }
        } catch { /* skip */ }
      }
      setTrend(points.reverse());
    }
    loadTrend();
  }, [userId, quarters]);

  const achievement = calcUserAchievement(objectives as Parameters<typeof calcUserAchievement>[0]);
  const allSubmitted = objectives.length > 0 && objectives.every((o) => o.status === "SUBMITTED");

  const achBg = objectives.length === 0 ? "" : achievement >= 100
    ? "bg-green-50 border-green-200 text-green-800"
    : achievement >= 70
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-red-50 border-red-200 text-red-700";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Dashboard</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400 flex-shrink-0">Quarter:</span>
            <YearQuarterPicker quarters={quarters} value={selectedQ} onChange={setSelectedQ} />
          </div>
        </div>

        {objectives.length > 0 && !loading && (
          <div className={`border rounded-2xl px-6 py-3 text-center ${achBg}`}>
            <p className="text-xs font-semibold mb-0.5">Achievement OKR</p>
            <p className="text-3xl font-bold leading-tight">{achievement.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* Status banner */}
      {allSubmitted && !loading ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-medium">
          Your OKR has been submitted.
        </div>
      ) : objectives.length > 0 && !loading ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
          OKR not submitted yet. <a href="/okr" className="underline font-semibold">Submit →</a>
        </div>
      ) : null}

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <span className="text-2xl animate-spin mr-3"></span> Loading...
        </div>
      )}

      {!loading && objectives.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-2"></div>
          <p className="text-slate-500 text-sm mb-3">No OKRs for this quarter yet.</p>
          <a href="/okr" className="inline-flex items-center gap-2 bg-[#0b8ec4] text-white hover:bg-[#097eb9] font-bold text-sm px-5 py-2.5 rounded-xl
            shadow-sm hover:shadow-sm
            active:shadow-sm transition-all duration-75">
            Fill in OKR Now →
          </a>
        </div>
      )}

      {/* Objectives */}
      {!loading && objectives.length > 0 && (
        <div className="space-y-4">
          {objectives.map((obj, idx) => {
            const oa = calcObjectiveAchievement(obj as Parameters<typeof calcObjectiveAchievement>[0]);
            return <ObjectiveCard key={obj.id} obj={obj} oa={oa} index={idx} />;
          })}
        </div>
      )}

      {/* Trend chart */}
      {trend.length >= 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-700 text-sm">Achievement Trend per Quarter</h2>
          </div>
          <div className="p-5 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, "Achievement"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 2" />
                <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="achievement" stroke="#f59e0b" strokeWidth={2.5}
                  dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-4 flex gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> ≥100% (target)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" /> ≥70% (good)</span>
          </div>
        </div>
      )}
    </div>
  );
}
