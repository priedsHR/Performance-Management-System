"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import YearQuarterPicker from "@/components/YearQuarterPicker";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberContrib = { memberId: string; memberName: string; progress: number };
type KRData = {
  id: string; title: string; target: number; unit: string; weight: number;
  teamProgress: number; leadProgress: number | null; achievement: number;
  memberContributions: MemberContrib[];
};
type ObjData = {
  id: string; title: string; weight: number; achievement: number; keyResults: KRData[];
};
type MemberData = { id: string; name: string; achievement: number };
type DivisionData = {
  objectives: ObjData[]; members: MemberData[]; divisionAchievement: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PALETTE = ["#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f97316", "#84cc16"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function achClass(v: number) {
  return v >= 90 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
}
function achEmoji(v: number) { return v >= 90 ? "🏆" : v >= 70 ? "🔥" : "📉"; }
function barColor(v: number) { return v >= 90 ? "#22c55e" : v >= 70 ? "#f59e0b" : "#f87171"; }

function PctBadge({ value }: { value: number }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${achClass(value)}`}>
      {achEmoji(value)} {value.toFixed(1)}%
    </span>
  );
}

function ProgressBar({ value, size = "md" }: { value: number; size?: "xs" | "sm" | "md" }) {
  const h = size === "xs" ? "h-1" : size === "sm" ? "h-1.5" : "h-2";
  const bg = value >= 90 ? "bg-green-500" : value >= 70 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className={`${h} bg-slate-100 rounded-full overflow-hidden`}>
      <div className={`${h} ${bg} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ─── Chart 1: Radar per Objective ────────────────────────────────────────────

function RadarObjectivesChart({ objectives }: { objectives: ObjData[] }) {
  if (objectives.length < 3) return null;
  const data = objectives.map((o, i) => ({ subject: `OBJ ${i + 1}`, value: parseFloat(o.achievement.toFixed(1)), fullMark: 100 }));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">🕸️ Radar Objective</p>
      <p className="text-xs text-slate-400 mb-3">Keseimbangan capaian antar objective</p>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} />
          <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} strokeWidth={2} />
          <Tooltip formatter={(v: unknown) => `${(v as number).toFixed(1)}%`} contentStyle={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
        {objectives.map((o, i) => (
          <p key={o.id} className="text-xs text-slate-500 truncate">
            <span className="font-semibold text-slate-700">OBJ {i + 1}:</span>{" "}
            {o.title.length > 30 ? o.title.slice(0, 30) + "…" : o.title}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Chart 2: Bar per Objective ───────────────────────────────────────────────

function BarObjectivesChart({ objectives }: { objectives: ObjData[] }) {
  if (objectives.length === 0) return null;
  const data = objectives.map((o, i) => ({ name: `OBJ ${i + 1}`, pct: parseFloat(o.achievement.toFixed(1)), title: o.title }));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">📊 Achievement per Objective</p>
      <p className="text-xs text-slate-400 mb-3">Perbandingan % capaian tiap objective</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} width={38} />
          <Tooltip formatter={(v: unknown) => `${(v as number).toFixed(1)}%`} labelFormatter={(_, p) => p[0]?.payload?.title ?? ""} contentStyle={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
          <Bar dataKey="pct" name="Achievement" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {data.map((d, i) => <Cell key={i} fill={barColor(d.pct)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Chart 3: Donut komposisi weight ───────────────────────────────────────────

function DonutObjectivesChart({ objectives, divisionAchievement }: { objectives: ObjData[]; divisionAchievement: number }) {
  if (objectives.length === 0) return null;
  const data = objectives.map((o, i) => ({ name: `OBJ ${i + 1}`, value: o.weight, achievement: o.achievement, title: o.title }));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">🍩 Komposisi Weight</p>
      <p className="text-xs text-slate-400 mb-3">Proporsi weight tiap objective</p>
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={65} outerRadius={95} dataKey="value" paddingAngle={3}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v: unknown, _: unknown, p: { payload?: { achievement?: number; title?: string } }) => [`${v}% weight · ${(p.payload?.achievement ?? 0).toFixed(1)}% capaian`, p.payload?.title ?? ""]} contentStyle={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800">{divisionAchievement.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">Division</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span>{d.name} ({d.value}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart 4: Stacked bar member per KR ──────────────────────────────────────

function MemberStackedChart({ keyResults }: { keyResults: KRData[] }) {
  const krsWithContribs = keyResults.filter((kr) => kr.memberContributions.length > 0);
  if (krsWithContribs.length === 0) return null;

  const allMembers = Array.from(
    new Map(krsWithContribs.flatMap((kr) => kr.memberContributions.map((c) => [c.memberId, c.memberName]))).entries()
  ).map(([id, name]) => ({ id, name }));

  const data = krsWithContribs.map((kr, i) => {
    const entry: Record<string, number | string> = { name: `KR ${i + 1}`, fullName: kr.title };
    allMembers.forEach((m) => {
      const c = kr.memberContributions.find((c) => c.memberId === m.id);
      entry[m.name] = kr.target > 0 && c ? parseFloat(Math.min((c.progress / kr.target) * 100, 100).toFixed(1)) : 0;
    });
    return entry;
  });

  return (
    <div className="mt-5 pt-5 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">📊 Kontribusi Member per KR</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} width={35} />
          <Tooltip formatter={(v: unknown, name: unknown) => [`${(v as number).toFixed(1)}%`, name as string]} labelFormatter={(_, p) => p[0]?.payload?.fullName ?? ""} contentStyle={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          {allMembers.map((m, i) => (
            <Bar key={m.id} dataKey={m.name} stackId="a" fill={PALETTE[i % PALETTE.length]}
              radius={i === allMembers.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── KR Chart ─────────────────────────────────────────────────────────────────

function KRChart({ keyResults }: { keyResults: KRData[] }) {
  if (keyResults.length === 0) return null;
  return (
    <div className="mt-4 space-y-2.5">
      {keyResults.map((kr) => (
        <div key={kr.id}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <span className="text-xs text-slate-600 leading-snug">{kr.title}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${achClass(kr.achievement)}`}>
              {kr.achievement.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${Math.min(kr.achievement, 100)}%`, backgroundColor: barColor(kr.achievement) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Objective section ────────────────────────────────────────────────────────

function ObjectiveSection({ obj, index }: { obj: ObjData; index: number }) {
  const [open, setOpen] = useState(true);
  const [showContrib, setShowContrib] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Objective header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">🎯</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-600 mb-0.5">Objective #{index + 1}</p>
            <h3 className="font-bold text-slate-800 text-sm leading-snug">{obj.title}</h3>
            <span className="text-xs text-slate-400">⚖️ Weight {obj.weight}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <PctBadge value={obj.achievement} />
          <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {open && <>
      <div className="px-5 py-2 border-t border-slate-100">
        <ProgressBar value={obj.achievement} />
      </div>

      <div className="p-5 space-y-5">
        {/* KR Table */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">🔑 Key Results</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-slate-400">Key Result</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Target</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Satuan</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Weight</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Progress</th>
                  <th className="text-right py-2 pl-2 text-xs font-semibold text-slate-400">Achievement</th>
                </tr>
              </thead>
              <tbody>
                {obj.keyResults.map((kr) => {
                  const progress = kr.teamProgress + (kr.leadProgress ?? 0);
                  return (
                    <tr key={kr.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">
                        <span className="break-words">{kr.title}</span>
                        {kr.leadProgress != null && kr.leadProgress > 0 && (
                          <span className="text-xs text-blue-500">➕ lead: {kr.leadProgress}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600 tabular-nums">{kr.target}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{kr.unit}</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-600">{kr.weight}%</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                        {Number.isInteger(progress) ? progress : progress.toFixed(2)} / {kr.target}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${achClass(kr.achievement)}`}>
                          {kr.achievement.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* KR Chart */}
        <KRChart keyResults={obj.keyResults} />

        {/* Stacked member chart */}
        <MemberStackedChart keyResults={obj.keyResults} />

        {/* Member contribution toggle */}
        {obj.keyResults.some((kr) => kr.memberContributions.length > 0) && (
          <div>
            <button
              onClick={() => setShowContrib((v) => !v)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 font-semibold transition"
            >
              👥 Kontribusi Member {showContrib ? "▲" : "▼"}
            </button>

            {showContrib && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 pr-3 text-xs font-semibold text-slate-400">Member</th>
                      {obj.keyResults.filter((kr) => kr.memberContributions.length > 0).map((kr) => (
                        <th key={kr.id} className="text-right py-2 px-2 text-xs font-semibold text-slate-400 min-w-[80px]">
                          <span className="break-words">{kr.title}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Collect unique members */}
                    {Array.from(
                      new Map(
                        obj.keyResults.flatMap((kr) =>
                          kr.memberContributions.map((c) => [c.memberId, { id: c.memberId, name: c.memberName }])
                        )
                      ).values()
                    ).map((member) => (
                      <tr key={member.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-3 font-medium text-slate-700 text-xs">{member.name}</td>
                        {obj.keyResults
                          .filter((kr) => kr.memberContributions.length > 0)
                          .map((kr) => {
                            const contrib = kr.memberContributions.find((c) => c.memberId === member.id);
                            const pct = kr.target > 0 && contrib
                              ? Math.min((contrib.progress / kr.target) * 100, 100)
                              : 0;
                            return (
                              <td key={kr.id} className="py-2 px-2 text-right text-xs">
                                {contrib ? (
                                  <div>
                                    <span className="font-semibold text-slate-700 tabular-nums">
                                      {contrib.progress}/{kr.target} {kr.unit}
                                    </span>
                                    <span className={`ml-1 font-semibold ${pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-500" : "text-red-500"}`}>({pct.toFixed(0)}%)</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Props = {
  quarters: { id: string; name: string; year: number; quarter: number; isActive: boolean }[];
  leadId: string;
  divisionName: string;
  defaultQuarterId?: string;
};

export default function DivisionView({ quarters, leadId, divisionName, defaultQuarterId }: Props) {
  const activeQ = quarters.find((q) => q.isActive) ?? quarters[0];
  const [selectedQ, setSelectedQ] = useState(defaultQuarterId ?? activeQ?.id ?? "");
  const [data, setData] = useState<DivisionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedQ) return;
    setLoading(true);
    fetch(`/api/dashboard/division?quarterId=${selectedQ}&leadId=${leadId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedQ, leadId]);

  const achBg = !data ? "" : data.divisionAchievement >= 100
    ? "bg-green-50 border-green-200 text-green-800"
    : data.divisionAchievement >= 70
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-red-50 border-red-200 text-red-700";

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">📊 {divisionName}</h1>
          {/* Quarter selector */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-slate-400 flex-shrink-0">⏱️ Quarter:</span>
            <YearQuarterPicker quarters={quarters} value={selectedQ} onChange={setSelectedQ} />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap print:hidden">
          {data && (
            <div className={`border rounded-2xl px-6 py-3 text-center ${achBg}`}>
              <p className="text-xs font-semibold mb-0.5">🏆 Achievement Division</p>
              <p className="text-3xl font-bold leading-tight">{data.divisionAchievement.toFixed(1)}%</p>
            </div>
          )}
          <div className="flex gap-2">
            {selectedQ && (
              <button
                onClick={() => window.open(`/api/dashboard/division/print?leadId=${leadId}&quarterId=${selectedQ}&divisionName=${encodeURIComponent(divisionName)}`)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px transition-all duration-75"
              >🖨️ Print PDF</button>
            )}
            {selectedQ && (
              <a
                href={`/api/dashboard/division/export?leadId=${leadId}&quarterId=${selectedQ}&divisionName=${encodeURIComponent(divisionName)}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px transition-all duration-75"
              >📊 Excel</a>
            )}
          </div>
        </div>
        {data && (
          <div className={`border rounded-2xl px-6 py-3 text-center hidden print:block ${achBg}`}>
            <p className="text-xs font-semibold mb-0.5">🏆 Achievement Division</p>
            <p className="text-3xl font-bold leading-tight">{data.divisionAchievement.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <span className="text-2xl animate-spin mr-3">⏳</span> Memuat data...
        </div>
      )}

      {!loading && data && quarters.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-700 text-sm">
          ⚠️ No quarter. Tambahkan di Admin → Quarter.
        </div>
      )}

      {!loading && data && data.objectives.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-2">🎯</div>
          <p className="text-slate-500 text-sm">No objectives for this quarter yet.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Charts Overview ── */}
          {data.objectives.length > 0 && (
            <div className="space-y-4">
              {/* Row 1: Radar + Donut side by side (only when ≥3 objectives) */}
              {data.objectives.length >= 3 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <RadarObjectivesChart objectives={data.objectives} />
                  <DonutObjectivesChart objectives={data.objectives} divisionAchievement={data.divisionAchievement} />
                </div>
              ) : (
                <DonutObjectivesChart objectives={data.objectives} divisionAchievement={data.divisionAchievement} />
              )}

              {/* Row 2: Bar per objective (full width) */}
              <BarObjectivesChart objectives={data.objectives} />
            </div>
          )}

          {/* ── Objective cards ── */}
          <div className="space-y-5">
            {data.objectives.map((obj, i) => (
              <ObjectiveSection key={obj.id} obj={obj} index={i} />
            ))}
          </div>

          {/* ── Member ranking ── */}
          {data.members.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700 text-sm">🏅 Ranking Achievement Member</h2>
              </div>

              <div className="divide-y divide-slate-50">
                {[...data.members]
                  .sort((a, b) => b.achievement - a.achievement)
                  .map((m, idx) => {
                    const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                        <span className="text-lg w-6 text-center">{medals[idx] ?? `${idx + 1}`}</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{m.name}</p>
                          <div className="mt-1"><ProgressBar value={m.achievement} size="xs" /></div>
                        </div>
                        <PctBadge value={m.achievement} />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
