"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Building2, Play } from "lucide-react";

type Pic = { id: string; name: string } | null;
type Initiative = { id: string; title: string; target: number; actual: number; unit: string; resultNote: string | null; pic: Pic };
type KeyResult = { id: string; title: string; target: number; unit: string; weight: number; teamProgress: number; leadProgress: number | null; initiatives: Initiative[] };
type Objective = { id: string; title: string; weight: number; status: string; keyResults: KeyResult[] };
type Dept = { division: string; leadNames: string[]; objectives: Objective[] };
type Quarter = { id: string; name: string; isActive: boolean };

function achClass(v: number) {
  return v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
}
function krAch(kr: KeyResult) {
  // Roll up from initiatives (avg of each initiative's %); fall back to team
  // progress when a KR has no initiatives.
  if (kr.initiatives.length > 0) {
    return kr.initiatives.reduce((s, it) => s + (it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0), 0) / kr.initiatives.length;
  }
  const actual = kr.leadProgress ?? kr.teamProgress;
  return kr.target > 0 ? Math.min((actual / kr.target) * 100, 100) : 0;
}
function objAch(obj: Objective) {
  if (obj.keyResults.length === 0) return 0;
  const tw = obj.keyResults.reduce((s, k) => s + k.weight, 0);
  if (tw <= 0) return obj.keyResults.reduce((s, k) => s + krAch(k), 0) / obj.keyResults.length;
  return obj.keyResults.reduce((s, k) => s + (krAch(k) * k.weight) / tw, 0);
}
function deptAch(d: Dept) { return d.objectives.length ? d.objectives.reduce((s, o) => s + objAch(o), 0) / d.objectives.length : 0; }
const hex = (v: number) => (v >= 100 ? "#16a34a" : v >= 70 ? "#f59e0b" : "#ef4444");

function Donut({ pct, size = 108, stroke = 12 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hex(pct)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800" style={{ fontSize: size * 0.24, fontWeight: 800 }}>{pct.toFixed(0)}%</text>
    </svg>
  );
}
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Analytics({ departments }: { departments: Dept[] }) {
  const deptStats = departments.map((d) => ({ name: d.division, ach: deptAch(d), objs: d.objectives.length })).sort((a, b) => b.ach - a.ach);
  const company = deptStats.length ? deptStats.reduce((s, d) => s + d.ach, 0) / deptStats.length : 0;
  const allObjs = departments.flatMap((d) => d.objectives);
  const allInits = departments.flatMap((d) => d.objectives.flatMap((o) => o.keyResults.flatMap((k) => k.initiatives)));

  // Per-person (PIC) achievement
  const pm = new Map<string, { sum: number; n: number }>();
  for (const it of allInits) {
    const name = it.pic?.name ?? "Unassigned";
    const a = it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0;
    const e = pm.get(name) ?? { sum: 0, n: 0 }; e.sum += a; e.n += 1; pm.set(name, e);
  }
  const people = [...pm.entries()].map(([name, v]) => ({ name, ach: v.sum / v.n, n: v.n })).filter((p) => p.name !== "Unassigned").sort((a, b) => b.ach - a.ach);

  // Status split (by objective)
  const onTrack = allObjs.filter((o) => objAch(o) >= 100).length;
  const nearly = allObjs.filter((o) => { const a = objAch(o); return a >= 70 && a < 100; }).length;
  const behind = allObjs.filter((o) => objAch(o) < 70).length;
  const total = allObjs.length || 1;

  const maxPeople = 8;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
      <h2 className="text-sm font-bold text-slate-800">Company OKR Analytics</h2>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <Donut pct={company} size={84} stroke={10} />
          <div><p className="text-xs text-slate-400">Company</p><p className="text-sm font-semibold text-slate-600">achievement</p></div>
        </div>
        <Tile label="Departments" value={String(departments.length)} />
        <Tile label="Objectives" value={String(allObjs.length)} sub={`${onTrack} on track`} />
        <Tile label="Initiatives" value={String(allInits.length)} />
      </div>

      {/* Achievement by department */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Achievement by Department</p>
        <div className="space-y-2.5">
          {deptStats.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-28 truncate flex-shrink-0">{d.name}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden">
                <div className="h-4 rounded-md" style={{ width: `${Math.min(d.ach, 100)}%`, background: hex(d.ach) }} />
              </div>
              <span className="text-xs font-bold w-10 text-right flex-shrink-0" style={{ color: hex(d.ach) }}>{d.ach.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* By person */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Achievement by Person (PIC)</p>
          {people.length === 0 ? (
            <p className="text-xs text-slate-300 italic">No initiatives assigned to people yet.</p>
          ) : (
            <div className="space-y-2">
              {people.slice(0, maxPeople).map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-28 truncate flex-shrink-0" title={p.name}>{p.name}</span>
                  <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-3.5 rounded-full" style={{ width: `${Math.min(p.ach, 100)}%`, background: hex(p.ach) }} />
                  </div>
                  <span className="text-[11px] text-slate-400 w-6 text-right flex-shrink-0">{p.n}</span>
                  <span className="text-xs font-bold w-9 text-right flex-shrink-0" style={{ color: hex(p.ach) }}>{p.ach.toFixed(0)}%</span>
                </div>
              ))}
              {people.length > maxPeople && <p className="text-[11px] text-slate-300">+{people.length - maxPeople} more</p>}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Objective Status</p>
          <div className="flex h-4 rounded-full overflow-hidden mb-3">
            <div style={{ width: `${(onTrack / total) * 100}%`, background: "#16a34a" }} />
            <div style={{ width: `${(nearly / total) * 100}%`, background: "#f59e0b" }} />
            <div style={{ width: `${(behind / total) * 100}%`, background: "#ef4444" }} />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> On track (≥100%) <span className="ml-auto font-bold text-slate-700">{onTrack}</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Nearly there (70–99%) <span className="ml-auto font-bold text-slate-700">{nearly}</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Behind (&lt;70%) <span className="ml-auto font-bold text-slate-700">{behind}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
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
        <>
        <Analytics departments={departments} />
        {departments.map((dept) => {
          const isOpen = open[dept.division] ?? true;
          const deptObjs = dept.objectives;
          const deptAch = deptObjs.length ? deptObjs.reduce((s, o) => s + objAch(o), 0) / deptObjs.length : 0;
          return (
            <div key={dept.division} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition">
                <button onClick={() => setOpen((p) => ({ ...p, [dept.division]: !isOpen }))} className="flex-1 flex items-center justify-between px-5 py-4 text-left min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 size={18} className="text-[#097eb9] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{dept.division}</p>
                      <p className="text-xs text-slate-400 truncate">{dept.leadNames.join(", ")} · {deptObjs.length} objective{deptObjs.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${achClass(deptAch)}`}>{deptAch.toFixed(0)}%</span>
                    <span className="text-slate-300">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                  </div>
                </button>
                <Link
                  href={`/okr/present?division=${encodeURIComponent(dept.division)}&quarterId=${quarterId}`}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 mr-4 rounded-lg bg-[#097eb9] text-white hover:bg-[#0b6fa3] flex-shrink-0"
                  title="Open the OKR meeting presentation"
                >
                  <Play size={13} /> Present
                </Link>
              </div>

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
        })}
        </>
      )}
    </div>
  );
}
