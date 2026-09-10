"use client";

import { useEffect, useState, Fragment } from "react";
import { ChevronDown, ChevronUp, Building2 } from "lucide-react";

type Pic = { id: string; name: string } | null;
type Initiative = { id: string; title: string; target: number; actual: number; unit: string; resultNote: string | null; pic: Pic };
type KeyResult = { id: string; title: string; target: number; unit: string; weight: number; teamProgress: number; leadProgress: number | null; initiatives: Initiative[] };
type Objective = { id: string; title: string; weight: number; status: string; keyResults: KeyResult[] };
type Dept = { ownerId: string; ownerName: string; division: string | null; objectives: Objective[] };
type Quarter = { id: string; name: string; isActive: boolean };

function achClass(v: number) {
  return v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
}
function krAch(kr: KeyResult) {
  const actual = kr.leadProgress ?? kr.teamProgress;
  return kr.target > 0 ? Math.min((actual / kr.target) * 100, 100) : 0;
}
function objAch(obj: Objective) {
  const tw = obj.keyResults.reduce((s, k) => s + k.weight, 0);
  if (tw <= 0) return 0;
  return obj.keyResults.reduce((s, k) => s + (krAch(k) * k.weight) / tw, 0);
}

export default function CompanyOKR({ quarters }: { quarters: Quarter[] }) {
  const [quarterId, setQuarterId] = useState(quarters.find((q) => q.isActive)?.id ?? quarters[0]?.id ?? "");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!quarterId) return;
    setLoading(true);
    fetch(`/api/okr/company?quarterId=${quarterId}`)
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []))
      .finally(() => setLoading(false));
  }, [quarterId]);

  if (quarters.length === 0)
    return <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">No quarters yet.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Quarter</label>
          <select value={quarterId} onChange={(e) => setQuarterId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            {quarters.map((q) => <option key={q.id} value={q.id}>{q.name}{q.isActive ? " (active)" : ""}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-400">{departments.length} department{departments.length === 1 ? "" : "s"}</p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : departments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">No OKR submitted for this quarter yet.</div>
      ) : (
        departments.map((dept) => {
          const isOpen = open[dept.ownerId] ?? true;
          const deptObjs = dept.objectives;
          const deptAch = deptObjs.length ? deptObjs.reduce((s, o) => s + objAch(o), 0) / deptObjs.length : 0;
          return (
            <div key={dept.ownerId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button onClick={() => setOpen((p) => ({ ...p, [dept.ownerId]: !isOpen }))} className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 size={18} className="text-[#097eb9] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{dept.division || dept.ownerName}</p>
                    <p className="text-xs text-slate-400 truncate">Lead: {dept.ownerName} · {deptObjs.length} objective{deptObjs.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${achClass(deptAch)}`}>{deptAch.toFixed(0)}%</span>
                  <span className="text-slate-300">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </div>
              </button>

              {isOpen && (
                <div className="p-5 space-y-5">
                  {deptObjs.map((obj, oi) => (
                    <div key={obj.id} className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/70">
                        <p className="font-semibold text-slate-800 text-sm">
                          <span className="text-amber-600">Objective {oi + 1}</span> · {obj.title}
                          <span className="text-xs text-slate-400 font-normal"> (weight {obj.weight}%)</span>
                        </p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${achClass(objAch(obj))}`}>{objAch(obj).toFixed(0)}%</span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="text-slate-400 bg-white">
                              <th className="text-left font-semibold py-2 px-3">Key Result / Initiative</th>
                              <th className="text-left font-semibold py-2 px-2 w-28">PIC</th>
                              <th className="text-right font-semibold py-2 px-2 w-16">Target</th>
                              <th className="text-right font-semibold py-2 px-2 w-16">Actual</th>
                              <th className="text-right font-semibold py-2 px-2 w-14">% Ach</th>
                              <th className="text-left font-semibold py-2 px-2 w-40">Results & Evaluation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {obj.keyResults.map((kr, ki) => {
                              const actual = kr.leadProgress ?? kr.teamProgress;
                              return (
                                <Fragment key={kr.id}>
                                  <tr className="border-t border-slate-100 bg-white">
                                    <td className="py-2 px-3 font-semibold text-slate-700">
                                      <span className="text-slate-400 mr-1">KR {oi + 1}.{ki + 1}</span>{kr.title}
                                    </td>
                                    <td className="py-2 px-2 text-slate-400">—</td>
                                    <td className="py-2 px-2 text-right tabular-nums text-slate-600">{kr.target} {kr.unit}</td>
                                    <td className="py-2 px-2 text-right tabular-nums text-slate-600">{actual}</td>
                                    <td className="py-2 px-2 text-right"><span className={`font-bold px-1.5 py-0.5 rounded ${achClass(krAch(kr))}`}>{krAch(kr).toFixed(0)}%</span></td>
                                    <td className="py-2 px-2 text-slate-400">weight {kr.weight}%</td>
                                  </tr>
                                  {kr.initiatives.map((it) => {
                                    const iAch = it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0;
                                    return (
                                      <tr key={it.id} className="border-t border-slate-50">
                                        <td className="py-1.5 px-3 pl-8 text-slate-600">↳ {it.title}</td>
                                        <td className="py-1.5 px-2 text-slate-500">{it.pic?.name ?? "—"}</td>
                                        <td className="py-1.5 px-2 text-right tabular-nums text-slate-500">{it.target} {it.unit}</td>
                                        <td className="py-1.5 px-2 text-right tabular-nums text-slate-500">{it.actual}</td>
                                        <td className="py-1.5 px-2 text-right"><span className={`font-bold px-1.5 py-0.5 rounded ${achClass(iAch)}`}>{iAch.toFixed(0)}%</span></td>
                                        <td className="py-1.5 px-2 text-slate-500">{it.resultNote || ""}</td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                            {obj.keyResults.length === 0 && (
                              <tr><td colSpan={6} className="py-3 px-3 text-center text-slate-300">No key results.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
