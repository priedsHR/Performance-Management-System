"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import YearQuarterPicker from "@/components/YearQuarterPicker";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type KRAData = {
  kraId: string; krId: string; krTitle: string;
  target: number; targetDivisi?: number; individualTarget?: number | null;
  unit: string; weight: number;
  progress: number; achievement: number;
};
type AssignmentData = {
  assignmentId: string; objectiveId: string; objectiveTitle: string;
  weight: number; achievement: number; krAssignments: KRAData[];
};
type IndividualData = {
  member: { id: string; name: string };
  achievement: number;
  assignments: AssignmentData[];
};
type TrendPoint = { quarterId: string; quarterName: string; quarterLabel: string; achievement: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function achClass(v: number) {
  return v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
}
function achEmoji(v: number) { return v >= 100 ? "🏆" : v >= 70 ? "🔥" : "📉"; }
function barColor(v: number) { return v >= 100 ? "#22c55e" : v >= 70 ? "#f59e0b" : "#f87171"; }

function PctBadge({ value }: { value: number }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${achClass(value)}`}>
      {achEmoji(value)} {value.toFixed(1)}%
    </span>
  );
}

function ProgressBar({ value, size = "sm" }: { value: number; size?: "xs" | "sm" }) {
  const h = size === "xs" ? "h-1" : "h-1.5";
  const bg = value >= 100 ? "bg-green-500" : value >= 70 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className={`${h} bg-slate-100 rounded-full overflow-hidden`}>
      <div className={`${h} ${bg} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ─── Trend chart ──────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length < 2) return null;

  const data = trend.map((t) => ({
    name: t.quarterLabel,
    achievement: parseFloat(t.achievement.toFixed(1)),
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
        <h2 className="font-bold text-slate-700 text-sm">📈 Tren Achievement per Quarter</h2>
      </div>
      <div className="p-5 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
            <Tooltip
              formatter={(v) => [`${v}%`, "Achievement"]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "100%", fontSize: 10, fill: "#22c55e" }} />
            <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 2" />
            <Line
              type="monotone"
              dataKey="achievement"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pb-4 flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> ≥100% (target)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" /> ≥70% (baik)</span>
      </div>
    </div>
  );
}

// ─── KR chart ────────────────────────────────────────────────────────────────

function KRChart({ krs }: { krs: KRAData[] }) {
  if (krs.length === 0) return null;
  return (
    <div className="mt-3 space-y-2.5">
      {krs.map((k) => (
        <div key={k.kraId}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <span className="text-xs text-slate-600 leading-snug">{k.krTitle}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${achClass(k.achievement)}`}>
              {k.achievement.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${Math.min(k.achievement, 100)}%`, backgroundColor: barColor(k.achievement) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Assignment section ────────────────────────────────────────────────────────

function AssignmentSection({ a, index }: { a: AssignmentData; index: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">🎯</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-600 mb-0.5">Objective #{index + 1}</p>
            <h3 className="font-bold text-slate-800 text-sm leading-snug">{a.objectiveTitle}</h3>
            <span className="text-xs text-slate-400">⚖️ Weight {a.weight}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <PctBadge value={a.achievement} />
          <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {open && (
        <>
          <div className="px-5 py-2 border-b border-slate-100">
            <ProgressBar value={a.achievement} size="xs" />
          </div>

          <div className="p-5 space-y-4">
            {/* KR Table */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">🔑 Key Results (Kontribusi Saya)</p>
              {a.krAssignments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No KRs assigned yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 pr-3 text-xs font-semibold text-slate-400">Key Result</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Target</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Satuan</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Weight</th>
                        <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400">Progress Saya</th>
                        <th className="text-right py-2 pl-2 text-xs font-semibold text-slate-400">Achievement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.krAssignments.map((k) => (
                        <tr key={k.kraId} className="border-b border-slate-50 last:border-0">
                          <td className="py-2.5 pr-3 font-medium text-slate-700">
                            <span className="break-words">{k.krTitle}</span>
                            {k.individualTarget != null && (
                              <span className="text-xs text-blue-500">⚡ target individu</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600 tabular-nums">
                            {k.target}
                            {k.individualTarget != null && k.targetDivisi != null && k.targetDivisi !== k.target && (
                              <span className="block text-xs text-slate-400">(division: {k.targetDivisi})</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-400">{k.unit}</td>
                          <td className="py-2.5 px-2 text-right font-semibold text-slate-600">{k.weight}%</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                            {k.progress} / {k.target}
                          </td>
                          <td className="py-2.5 pl-2 text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${achClass(k.achievement)}`}>
                              {k.achievement.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* KR Chart */}
            {a.krAssignments.length > 0 && <KRChart krs={a.krAssignments} />}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Props = {
  quarters: { id: string; name: string; year: number; quarter: number; isActive: boolean }[];
  members: { id: string; name: string }[];
  leadId: string;
  defaultQuarterId?: string;
};

export default function IndividualView({ quarters, members, leadId, defaultQuarterId }: Props) {
  const activeQ = quarters.find((q) => q.isActive) ?? quarters[0];
  const [selectedQ, setSelectedQ] = useState(defaultQuarterId ?? activeQ?.id ?? "");
  const [selectedMember, setSelectedMember] = useState(members[0]?.id ?? "");
  const [data, setData] = useState<IndividualData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);

  // Fetch per-quarter data
  useEffect(() => {
    if (!selectedQ || !selectedMember) { setData(null); return; }
    setLoading(true);
    fetch(`/api/dashboard/individual?memberId=${selectedMember}&quarterId=${selectedQ}&leadId=${leadId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedQ, selectedMember, leadId]);

  // Fetch trend whenever member changes
  useEffect(() => {
    if (!selectedMember) { setTrend([]); return; }
    setTrendLoading(true);
    fetch(`/api/dashboard/member-trend?memberId=${selectedMember}&leadId=${leadId}`)
      .then((r) => r.json())
      .then((d) => { setTrend(d.trend ?? []); setTrendLoading(false); })
      .catch(() => setTrendLoading(false));
  }, [selectedMember, leadId]);

  const achBg = !data ? "" : data.achievement >= 100
    ? "bg-green-50 border-green-200 text-green-800"
    : data.achievement >= 70
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-red-50 border-red-200 text-red-700";

  return (
    <div className="space-y-6">
      {/* Selectors row */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1.5">⏱️ Quarter</p>
            <YearQuarterPicker quarters={quarters} value={selectedQ} onChange={setSelectedQ} />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5">👤 Member</p>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white
                shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px transition-all duration-75"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {data && data.assignments.length > 0 && (
            <div className={`border rounded-2xl px-6 py-3 text-center ${achBg}`}>
              <p className="text-xs font-semibold mb-0.5">🏆 Achievement</p>
              <p className="text-3xl font-bold leading-tight">{data.achievement.toFixed(1)}%</p>
            </div>
          )}
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px transition-all duration-75"
            >🖨️ Print PDF</button>
            {selectedMember && selectedQ && (
              <a
                href={`/api/dashboard/individual/export?memberId=${selectedMember}&quarterId=${selectedQ}&leadId=${leadId}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px transition-all duration-75"
              >📊 Excel</a>
            )}
          </div>
        </div>
      </div>

      {members.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-slate-500 text-sm">No members yet. Add them on the Division OKR page.</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <span className="text-2xl animate-spin mr-3">⏳</span> Memuat data...
        </div>
      )}

      {!loading && data && data.assignments.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-2">🎯</div>
          <p className="text-slate-500 text-sm">This member has no assignments for this quarter yet.</p>
        </div>
      )}

      {!loading && data && data.assignments.length > 0 && (
        <div className="space-y-5">
          {data.assignments.map((a, i) => (
            <AssignmentSection key={a.assignmentId} a={a} index={i} />
          ))}
        </div>
      )}

      {/* Trend chart */}
      {!trendLoading && trend.length >= 2 && (
        <TrendChart trend={trend} />
      )}

      {!trendLoading && trend.length === 1 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-400 text-sm text-center">
          📈 Tren akan tampil setelah ada data dari 2+ quarter.
        </div>
      )}
    </div>
  );
}
