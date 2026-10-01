"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Monthly = { year: number; month: number; actual: number };
type Initiative = { id: string; title: string; target: number; actual: number; unit: string; resultNote: string | null; pic: { name: string } | null; monthly: Monthly[] };
type KeyResult = { id: string; title: string; target: number; unit: string; weight: number; teamProgress: number; leadProgress: number | null; initiatives: Initiative[] };
type Objective = { id: string; title: string; weight: number; keyResults: KeyResult[] };
type Owner = { id: string; name: string; division: string | null };

function initAch(it: Initiative) { return it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0; }
function krAch(kr: KeyResult) {
  if (kr.initiatives.length > 0) return kr.initiatives.reduce((s, it) => s + initAch(it), 0) / kr.initiatives.length;
  const actual = kr.leadProgress ?? kr.teamProgress;
  return kr.target > 0 ? Math.min((actual / kr.target) * 100, 100) : 0;
}
function objAch(obj: Objective) {
  if (obj.keyResults.length === 0) return 0;
  const tw = obj.keyResults.reduce((s, k) => s + k.weight, 0);
  if (tw <= 0) return obj.keyResults.reduce((s, k) => s + krAch(k), 0) / obj.keyResults.length;
  return obj.keyResults.reduce((s, k) => s + (krAch(k) * k.weight) / tw, 0);
}
function tone(v: number) {
  return v >= 100 ? "text-green-700 bg-green-100" : v >= 70 ? "text-amber-700 bg-amber-100" : "text-red-600 bg-red-100";
}
function barColor(v: number) { return v >= 100 ? "bg-green-500" : v >= 70 ? "bg-amber-400" : "bg-red-400"; }

export default function PresentView({
  owner, curQuarter, nextQuarter, curMonths, curObjectives, nextObjectives,
}: {
  owner: Owner;
  curQuarter: { name: string; year: number; quarter: number };
  nextQuarter: { name: string } | null;
  curMonths: number[];
  curObjectives: Objective[];
  nextObjectives: Objective[];
}) {
  const overall = curObjectives.length
    ? curObjectives.reduce((s, o) => s + objAch(o) * (o.weight || 1), 0) / curObjectives.reduce((s, o) => s + (o.weight || 1), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top controls — hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <Link href="/company-okr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back to Company OKR
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-[#097eb9] text-white hover:bg-[#0b6fa3]">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#097eb9] to-[#49C5E9] rounded-2xl p-6 text-white">
        <p className="text-sm text-cyan-100 font-medium">OKR Review &amp; Planning</p>
        <h1 className="text-2xl font-extrabold mt-0.5">{owner.division || owner.name}</h1>
        <p className="text-cyan-100 text-sm mt-0.5">Lead: {owner.name}</p>
        <div className="flex items-end gap-6 mt-4">
          <div>
            <p className="text-xs text-cyan-100">{curQuarter.name} overall achievement</p>
            <p className="text-4xl font-extrabold">{overall.toFixed(0)}%</p>
          </div>
          <div className="flex-1 pb-1.5">
            <div className="h-3 bg-white/25 rounded-full overflow-hidden max-w-md">
              <div className="h-3 rounded-full bg-white" style={{ width: `${Math.min(overall, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Results & Evaluation (current quarter) ===== */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{curQuarter.name} — Results &amp; Evaluation</h2>
        <p className="text-sm text-slate-500 mb-3">Achievement per objective, with monthly progress and evaluation notes.</p>
        {curObjectives.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">No OKR for this quarter.</div>
        ) : (
          <div className="space-y-4">
            {curObjectives.map((obj, oi) => (
              <div key={obj.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden break-inside-avoid">
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                  <p className="font-bold text-slate-800 text-sm"><span className="text-amber-600">Objective {oi + 1}</span> · {obj.title}</p>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${tone(objAch(obj))}`}>{objAch(obj).toFixed(0)}%</span>
                </div>
                <div className="p-5 space-y-4">
                  {obj.keyResults.map((kr, ki) => (
                    <div key={kr.id}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-slate-400">KR {oi + 1}.{ki + 1}</span>
                        <span className="text-sm font-semibold text-slate-700 flex-1">{kr.title}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${tone(krAch(kr))}`}>{krAch(kr).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div className={`h-1.5 rounded-full ${barColor(krAch(kr))}`} style={{ width: `${Math.min(krAch(kr), 100)}%` }} />
                      </div>
                      {kr.initiatives.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-slate-400">
                                <th className="text-left font-semibold py-1 pr-2">Initiative</th>
                                <th className="text-left font-semibold py-1 px-2 w-24">PIC</th>
                                <th className="text-right font-semibold py-1 px-1 w-14">Target</th>
                                {curMonths.map((m) => <th key={m} className="text-right font-semibold py-1 px-1 w-12">{MONTH_NAMES[m - 1]}</th>)}
                                <th className="text-right font-semibold py-1 px-1 w-12">% Ach</th>
                                <th className="text-left font-semibold py-1 px-2 w-48">Results &amp; Evaluation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {kr.initiatives.map((it) => (
                                <tr key={it.id} className="border-t border-slate-100 align-top">
                                  <td className="py-1.5 pr-2 text-slate-700">{it.title}</td>
                                  <td className="py-1.5 px-2 text-slate-500">{it.pic?.name ?? "—"}</td>
                                  <td className="py-1.5 px-1 text-right tabular-nums text-slate-600">{it.target}</td>
                                  {curMonths.map((m) => {
                                    const e = it.monthly.find((x) => x.month === m);
                                    return <td key={m} className="py-1.5 px-1 text-right tabular-nums text-slate-500">{e ? e.actual : "—"}</td>;
                                  })}
                                  <td className="py-1.5 px-1 text-right"><span className={`font-bold px-1.5 py-0.5 rounded ${tone(initAch(it))}`}>{initAch(it).toFixed(0)}%</span></td>
                                  <td className="py-1.5 px-2 text-slate-500">{it.resultNote || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== Plan (next quarter) ===== */}
      <section className="break-before-page">
        <h2 className="text-lg font-bold text-slate-900 mb-1">{nextQuarter ? `${nextQuarter.name} — Plan` : "Next Quarter — Plan"}</h2>
        <p className="text-sm text-slate-500 mb-3">Objectives, key results and initiatives proposed for the next quarter.</p>
        {!nextQuarter || nextObjectives.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-400 text-sm">
            {nextQuarter ? `No OKR drafted yet for ${nextQuarter.name}.` : "No next quarter has been created yet."}
          </div>
        ) : (
          <div className="space-y-4">
            {nextObjectives.map((obj, oi) => (
              <div key={obj.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden break-inside-avoid">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                  <p className="font-bold text-slate-800 text-sm"><span className="text-[#097eb9]">Objective {oi + 1}</span> · {obj.title}<span className="text-xs text-slate-400 font-normal"> (weight {obj.weight}%)</span></p>
                </div>
                <div className="p-5 space-y-3">
                  {obj.keyResults.map((kr, ki) => (
                    <div key={kr.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">KR {oi + 1}.{ki + 1}</span>
                        <span className="text-sm font-semibold text-slate-700 flex-1">{kr.title}</span>
                        <span className="text-xs text-slate-400">Target {kr.target} {kr.unit}</span>
                      </div>
                      {kr.initiatives.length > 0 && (
                        <ul className="mt-1.5 pl-6 space-y-1">
                          {kr.initiatives.map((it) => (
                            <li key={it.id} className="text-xs text-slate-600 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#49C5E9] flex-shrink-0" />
                              <span className="flex-1">{it.title}</span>
                              <span className="text-slate-400">{it.pic?.name ?? "—"} · target {it.target}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
