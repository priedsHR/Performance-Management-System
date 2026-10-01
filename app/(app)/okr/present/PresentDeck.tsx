"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, ChevronLeft, ChevronRight, Target as TargetIcon, TrendingUp, Flag } from "lucide-react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Monthly = { year: number; month: number; actual: number };
type Initiative = { id: string; title: string; target: number; actual: number; unit: string; resultNote: string | null; pic: { name: string } | null; monthly: Monthly[] };
type KeyResult = { id: string; title: string; target: number; unit: string; weight: number; teamProgress: number; leadProgress: number | null; initiatives: Initiative[] };
type Objective = { id: string; title: string; weight: number; user: { name: string }; keyResults: KeyResult[] };

function initAch(it: Initiative) { return it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0; }
function krActual(kr: KeyResult) { return kr.initiatives.length > 0 ? (kr.leadProgress ?? kr.teamProgress) : (kr.leadProgress ?? kr.teamProgress); }
function krAch(kr: KeyResult) {
  if (kr.initiatives.length > 0) return kr.initiatives.reduce((s, it) => s + initAch(it), 0) / kr.initiatives.length;
  return kr.target > 0 ? Math.min((krActual(kr) / kr.target) * 100, 100) : 0;
}
function objAch(obj: Objective) {
  if (obj.keyResults.length === 0) return 0;
  const tw = obj.keyResults.reduce((s, k) => s + k.weight, 0);
  if (tw <= 0) return obj.keyResults.reduce((s, k) => s + krAch(k), 0) / obj.keyResults.length;
  return obj.keyResults.reduce((s, k) => s + (krAch(k) * k.weight) / tw, 0);
}
const hex = (v: number) => (v >= 100 ? "#16a34a" : v >= 70 ? "#f59e0b" : "#ef4444");
const bg = (v: number) => (v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600");

function Donut({ pct, size = 150, stroke = 16 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hex(pct)} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .5s" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800" style={{ fontSize: size * 0.22, fontWeight: 800 }}>{pct.toFixed(0)}%</text>
    </svg>
  );
}

// Aggregate target/actual across an objective's KRs (best-effort; unit = most common)
function objTotals(obj: Objective) {
  const target = obj.keyResults.reduce((s, k) => s + k.target, 0);
  const actual = obj.keyResults.reduce((s, k) => s + krActual(k), 0);
  const unitCount: Record<string, number> = {};
  obj.keyResults.forEach((k) => { unitCount[k.unit] = (unitCount[k.unit] || 0) + 1; });
  const unit = Object.entries(unitCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return { target, actual, gap: Math.max(target - actual, 0), unit };
}

export default function PresentDeck({
  division, curQuarter, nextQuarter, curMonths, curObjectives, nextObjectives,
}: {
  division: string;
  curQuarter: { name: string; year: number; quarter: number };
  nextQuarter: { name: string } | null;
  curMonths: number[];
  curObjectives: Objective[];
  nextObjectives: Objective[];
}) {
  const overall = curObjectives.length
    ? curObjectives.reduce((s, o) => s + objAch(o) * (o.weight || 1), 0) / curObjectives.reduce((s, o) => s + (o.weight || 1), 0)
    : 0;

  // Build slides: cover + one per current objective + plan
  type Slide = { kind: "cover" } | { kind: "obj"; obj: Objective; idx: number } | { kind: "plan" };
  const slides: Slide[] = [
    { kind: "cover" },
    ...curObjectives.map((obj, idx) => ({ kind: "obj" as const, obj, idx })),
    { kind: "plan" as const },
  ];

  const [i, setI] = useState(0);
  const go = useCallback((d: number) => setI((v) => Math.min(Math.max(v + d, 0), slides.length - 1)), [slides.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === "PageDown") go(1); if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);

  const nextFocus = nextObjectives.slice(0, 4).map((o) => o.title);

  function CoverSlide() {
    return (
      <div className="h-full flex flex-col justify-center items-center text-center gap-5 px-10">
        <p className="text-sm font-semibold tracking-widest text-[#097eb9] uppercase">OKR Review &amp; Planning · {curQuarter.name}</p>
        <h1 className="text-4xl font-extrabold text-slate-900">{division}</h1>
        <Donut pct={overall} size={190} stroke={20} />
        <p className="text-slate-500 text-sm">Overall achievement across {curObjectives.length} objective{curObjectives.length === 1 ? "" : "s"}</p>
      </div>
    );
  }

  function ObjSlide({ obj, idx }: { obj: Objective; idx: number }) {
    const a = objAch(obj);
    const t = objTotals(obj);
    const notes = obj.keyResults.flatMap((k) => k.initiatives).filter((it) => (it.resultNote || "").trim()).slice(0, 4);
    const fillNotes = notes.length < 4
      ? obj.keyResults.flatMap((k) => k.initiatives).filter((it) => !(it.resultNote || "").trim()).slice(0, 4 - notes.length).map((it) => ({ ...it, resultNote: `${it.title} — ${initAch(it).toFixed(0)}% of target` }))
      : [];
    const highlights = [...notes, ...fillNotes];
    return (
      <div className="h-full flex flex-col px-8 py-6">
        <div className="mb-3">
          <h1 className="text-2xl font-extrabold text-slate-900">Evaluation · {curQuarter.name}</h1>
          <p className="text-slate-500 text-sm font-medium border-b-2 border-[#49C5E9] inline-block pb-0.5 mt-0.5">OBJECTIVE {idx + 1}: {obj.title}</p>
        </div>

        <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">
          {/* Left: overall + KR bars */}
          <div className="col-span-3 flex flex-col gap-3 min-h-0">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
              <Donut pct={a} size={120} stroke={14} />
              <div className="grid grid-cols-3 gap-2 flex-1">
                <KpiTile icon={<TargetIcon size={14} />} label="Target" value={t.target} unit={t.unit} color="text-[#097eb9]" />
                <KpiTile icon={<TrendingUp size={14} />} label="Actual" value={t.actual} unit={t.unit} color="text-green-600" />
                <KpiTile icon={<Flag size={14} />} label="Gap" value={t.gap} unit={t.unit} color="text-orange-500" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1 min-h-0 overflow-auto">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Achievement by Key Result</p>
              <div className="space-y-2.5">
                {obj.keyResults.map((kr, ki) => {
                  const kp = krAch(kr);
                  return (
                    <div key={kr.id} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 w-8 flex-shrink-0">{idx + 1}.{ki + 1}</span>
                      <span className="text-xs text-slate-600 flex-1 truncate" title={kr.title}>{kr.title}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums w-16 text-right flex-shrink-0">{krActual(kr)}/{kr.target}</span>
                      <div className="w-28 h-3.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-3.5 rounded-full" style={{ width: `${Math.min(kp, 100)}%`, background: hex(kp) }} />
                      </div>
                      <span className="text-[11px] font-bold w-10 text-right flex-shrink-0" style={{ color: hex(kp) }}>{kp.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: highlights */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-4 flex flex-col min-h-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Key Highlights &amp; Evaluation</p>
            <div className="space-y-2.5 overflow-auto flex-1">
              {highlights.length === 0 ? (
                <p className="text-xs text-slate-300 italic">No evaluation notes yet.</p>
              ) : highlights.map((it) => (
                <div key={it.id} className="flex gap-2 items-start">
                  <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: hex(initAch(it)) }} />
                  <p className="text-xs text-slate-600 leading-snug">
                    <span className="font-semibold text-slate-700">{it.pic?.name ?? it.title.slice(0, 20)}:</span> {it.resultNote}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: next-quarter focus */}
        {nextFocus.length > 0 && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs font-bold text-[#097eb9] uppercase tracking-wide flex-shrink-0">{nextQuarter?.name} Focus</span>
            <div className="flex gap-2 flex-wrap">
              {nextFocus.map((f, k) => <span key={k} className="text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-600">{f}</span>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  function PlanSlide() {
    return (
      <div className="h-full flex flex-col px-8 py-6">
        <div className="mb-3">
          <h1 className="text-2xl font-extrabold text-slate-900">{nextQuarter ? `${nextQuarter.name} — Plan` : "Next Quarter — Plan"}</h1>
          <p className="text-slate-500 text-sm">Objectives, key results &amp; initiatives for next quarter.</p>
        </div>
        <div className="flex-1 min-h-0 overflow-auto grid md:grid-cols-2 gap-3">
          {(!nextQuarter || nextObjectives.length === 0) ? (
            <div className="col-span-2 bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 text-sm">
              {nextQuarter ? `No OKR drafted yet for ${nextQuarter.name}.` : "No next quarter has been created yet."}
            </div>
          ) : nextObjectives.map((obj, oi) => (
            <div key={obj.id} className="bg-white border border-slate-200 rounded-xl p-4 break-inside-avoid">
              <p className="font-bold text-slate-800 text-sm mb-2"><span className="text-[#097eb9]">Objective {oi + 1}</span> · {obj.title}</p>
              <div className="space-y-2">
                {obj.keyResults.map((kr, ki) => (
                  <div key={kr.id}>
                    <p className="text-xs font-semibold text-slate-700">KR {oi + 1}.{ki + 1}: {kr.title} <span className="text-slate-400 font-normal">· target {kr.target} {kr.unit}</span></p>
                    {kr.initiatives.length > 0 && (
                      <ul className="pl-4 mt-0.5 space-y-0.5">
                        {kr.initiatives.map((it) => (
                          <li key={it.id} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-[#49C5E9] flex-shrink-0" />{it.title}<span className="text-slate-400">· {it.pic?.name ?? "—"}</span>
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
      </div>
    );
  }

  function renderSlide(s: Slide) {
    if (s.kind === "cover") return <CoverSlide />;
    if (s.kind === "plan") return <PlanSlide />;
    return <ObjSlide obj={s.obj} idx={s.idx} />;
  }

  return (
    <div className="space-y-3">
      {/* Controls — hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Link href="/company-okr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} disabled={i === 0} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-sm text-slate-500 tabular-nums w-16 text-center">{i + 1} / {slides.length}</span>
          <button onClick={() => go(1)} disabled={i === slides.length - 1} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={16} /></button>
          <button onClick={() => window.print()} className="ml-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-[#097eb9] text-white hover:bg-[#0b6fa3]"><Printer size={15} /> PDF</button>
        </div>
      </div>

      {/* On-screen: current slide only, 16:9 */}
      <div className="print:hidden">
        <div className="w-full max-w-5xl mx-auto aspect-[16/9] bg-gradient-to-br from-slate-50 to-cyan-50/40 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {renderSlide(slides[i])}
        </div>
      </div>

      {/* Print: every slide, each on its own page */}
      <div className="hidden print:block">
        {slides.map((s, idx) => (
          <div key={idx} className="w-full aspect-[16/9] bg-white border border-slate-200 rounded-2xl overflow-hidden break-after-page">
            {renderSlide(s)}
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiTile({ icon, label, value, unit, color }: { icon: React.ReactNode; label: string; value: number; unit: string; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <div className={`flex items-center justify-center gap-1 ${color}`}>{icon}<span className="text-[10px] font-bold uppercase tracking-wide">{label}</span></div>
      <p className="text-lg font-extrabold text-slate-800 leading-tight mt-0.5">{Number.isInteger(value) ? value : value.toFixed(1)}</p>
      <p className="text-[9px] text-slate-400">{unit}</p>
    </div>
  );
}
