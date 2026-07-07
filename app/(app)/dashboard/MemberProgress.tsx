"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import YearQuarterPicker from "@/components/YearQuarterPicker";

type KRItem = { id: string; title: string; target: number; unit: string; weight: number; progress: number; achievement: number };
type ObjItem = { id: string; title: string; weight: number; krs: KRItem[] };

function achClass(v: number) {
  return v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
}
function barColor(v: number) { return v >= 100 ? "#22c55e" : v >= 70 ? "#f59e0b" : "#f87171"; }

function ObjCard({ obj, index }: { obj: ObjItem; index: number }) {
  const [open, setOpen] = useState(true);
  const totalWeight = obj.krs.reduce((s, k) => s + k.weight, 0);
  const achievement = totalWeight > 0
    ? obj.krs.reduce((s, k) => s + (k.achievement * k.weight) / totalWeight, 0)
    : 0;

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
            <span className="text-xs text-slate-400">Weight {obj.weight}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${achClass(achievement)}`}>
            {achievement.toFixed(1)}%
          </span>
          <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {open && (
        <>
          <div className="px-5 py-2 border-t border-slate-100">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(achievement, 100)}%`, backgroundColor: barColor(achievement) }} />
            </div>
          </div>

          <div className="p-5">
            {obj.krs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No KRs assigned to you yet.</p>
            ) : (
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
                  {obj.krs.map((kr) => (
                    <tr key={kr.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{kr.title}</td>
                      <td className="py-2.5 px-2 text-right text-slate-600 tabular-nums">{kr.target}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{kr.unit}</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-600">{kr.weight}%</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">{kr.progress} / {kr.target}</td>
                      <td className="py-2.5 pl-2 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${achClass(kr.achievement)}`}>
                          {kr.achievement.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type Props = {
  quarters: { id: string; name: string; year: number; quarter: number; isActive: boolean }[];
  initialQuarterId: string;
};

export default function MemberProgress({ quarters, initialQuarterId }: Props) {
  const [selectedQ, setSelectedQ] = useState(initialQuarterId);
  const [objectives, setObjectives] = useState<ObjItem[]>([]);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!selectedQ) return;
    setLoading(true);
    setError(false);
    fetch(`/api/member/my-assignments?quarterId=${selectedQ}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setLinked(d.linked ?? false); setObjectives(d.objectives ?? []); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedQ]);

  const totalAchievement = objectives.length > 0
    ? objectives.reduce((s, obj) => {
        const totalW = obj.krs.reduce((sw, k) => sw + k.weight, 0);
        const objAch = totalW > 0 ? obj.krs.reduce((sa, k) => sa + (k.achievement * k.weight) / totalW, 0) : 0;
        return s + objAch * obj.weight;
      }, 0) / objectives.reduce((s, o) => s + o.weight, 0)
    : 0;

  const achBg = objectives.length === 0 ? "" : totalAchievement >= 100
    ? "bg-green-50 border-green-200 text-green-800"
    : totalAchievement >= 70
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-red-50 border-red-200 text-red-700";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My OKR Progress</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400 flex-shrink-0">Quarter:</span>
            <YearQuarterPicker quarters={quarters} value={selectedQ} onChange={setSelectedQ} />
          </div>
        </div>
        {objectives.length > 0 && !loading && (
          <div className={`border rounded-2xl px-6 py-3 text-center ${achBg}`}>
            <p className="text-xs font-semibold mb-0.5">My Achievement</p>
            <p className="text-3xl font-bold leading-tight">{totalAchievement.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <span className="text-2xl animate-spin mr-3"></span> Loading...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-sm">
          Failed to load data. Try refreshing the page.
        </div>
      )}

      {!loading && linked === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2"></div>
          <p className="font-semibold text-amber-800 mb-1">Account not linked to a team yet</p>
          <p className="text-sm text-amber-700">Contact the admin to link your account to the team distribution data.</p>
        </div>
      )}

      {!loading && linked && objectives.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-2"></div>
          <p className="text-slate-500 text-sm">No KRs assigned to you for this quarter yet.</p>
        </div>
      )}

      {!loading && objectives.length > 0 && (
        <div className="space-y-4">
          {objectives.map((obj, i) => <ObjCard key={obj.id} obj={obj} index={i} />)}
        </div>
      )}
    </div>
  );
}
