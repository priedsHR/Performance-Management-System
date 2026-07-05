"use client";

import { useEffect, useMemo, useState } from "react";

const bandClass: Record<string, string> = {
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
  teal: "bg-teal-50 text-teal-700",
  green: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-500",
};
const CAT_COLOR: Record<string, string> = {
  CORE: "#6366f1",
  LEADERSHIP: "#f59e0b",
  JOB_FAMILY: "#10b981",
  TECHNICAL: "#8b5cf6",
};
const CAT_LABEL: Record<string, string> = {
  CORE: "Core",
  LEADERSHIP: "Leadership",
  JOB_FAMILY: "Job Family",
  TECHNICAL: "Technical",
};

interface Period { id: string; name: string; half: string; year: number; isActive: boolean; releaseReports: boolean; }
interface CompScore { competencyId: string; code: string; name: string; category: string; groups: Record<string, number | null>; weighted: number | null; }
interface Report {
  hasData: boolean;
  targetLevel: number | null;
  overall: number | null;
  overallBand: { key: string; label: string; color: string };
  categories: { category: string; label: string; score: number | null; comps: CompScore[] }[];
  responseCount: number;
}
interface SinglePayload {
  period: { name: string; releaseReports: boolean };
  person: { name: string; position: string | null; department: string | null; level: string | null; targetLevel: number | null };
  report: Report;
  comments: Record<string, string[]>;
}
interface TrendItem { periodId: string; name: string; year: number; half: string; overall: number | null; categories: Record<string, number | null>; }

const fmt = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));

function Bar({ value, target }: { value: number | null; target: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 4) * 100));
  return (
    <div className="relative h-5 bg-slate-100 rounded-md overflow-hidden">
      {value != null && (
        <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-teal-500 to-teal-400 flex items-center justify-end pr-1.5 text-[10px] font-bold text-white rounded-l-md" style={{ width: `${pct}%`, minWidth: 26 }}>
          {value.toFixed(2)}
        </div>
      )}
      {target != null && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${(target / 4) * 100}%` }} />}
    </div>
  );
}

function TrendChart({ series }: { series: TrendItem[] }) {
  const W = 580, H = 240, padL = 34, padR = 12, padT = 14, padB = 42;
  const n = series.length;
  const x = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / 4);
  const cats = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

  function line(getter: (t: TrendItem) => number | null) {
    const pts = series.map((t, i) => ({ i, v: getter(t) })).filter((p) => p.v != null) as { i: number; v: number }[];
    return pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 620 }}>
      {[0, 1, 2, 3, 4].map((g) => (
        <g key={g}>
          <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke="#f1f5f9" />
          <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{g}</text>
        </g>
      ))}
      {cats.map((c) => (
        <polyline key={c} points={line((t) => t.categories[c] ?? null)} fill="none" stroke={CAT_COLOR[c]} strokeWidth="1.2" opacity="0.5" />
      ))}
      <polyline points={line((t) => t.overall)} fill="none" stroke="#0d9488" strokeWidth="2.5" />
      {series.map((t, i) => (
        <g key={t.periodId}>
          {t.overall != null && <circle cx={x(i)} cy={y(t.overall)} r="3.5" fill="#0d9488" />}
          {t.overall != null && <text x={x(i)} y={y(t.overall) - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f766e">{t.overall.toFixed(2)}</text>}
          <text x={x(i)} y={H - padB + 16} textAnchor="middle" fontSize="9" fill="#64748b">{t.half === "MID" ? "H1" : "H2"}</text>
          <text x={x(i)} y={H - padB + 28} textAnchor="middle" fontSize="9" fill="#94a3b8">{t.year}</text>
        </g>
      ))}
    </svg>
  );
}

export default function ReportView({ userId }: { userId: string; periodId?: string | null; isOwn?: boolean }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [half, setHalf] = useState<string>("MID");
  const [mode, setMode] = useState<"period" | "trend">("period");
  const [data, setData] = useState<SinglePayload | null>(null);
  const [trend, setTrend] = useState<TrendItem[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // load periods to drive the selectors
  useEffect(() => {
    fetch("/api/feedback/periods")
      .then((r) => r.json())
      .then((ps: Period[]) => {
        setPeriods(ps);
        const active = ps.find((p) => p.isActive) || ps[0];
        if (active) { setYear(active.year); setHalf(active.half); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const years = useMemo(() => [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a), [periods]);
  const selectedPeriod = useMemo(() => periods.find((p) => p.year === year && p.half === half) || null, [periods, year, half]);

  // fetch single report
  useEffect(() => {
    if (mode !== "period" || !selectedPeriod) { if (mode === "period") { setData(null); } return; }
    setLoading(true); setError("");
    fetch(`/api/feedback/report?userId=${userId}&periodId=${selectedPeriod.id}`)
      .then(async (r) => { if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Failed to load report."); } return r.json(); })
      .then(setData)
      .catch((e) => { setData(null); setError(e.message); })
      .finally(() => setLoading(false));
  }, [mode, selectedPeriod, userId]);

  // fetch trend
  useEffect(() => {
    if (mode !== "trend") return;
    setLoading(true); setError("");
    fetch(`/api/feedback/report?userId=${userId}&trend=1`)
      .then(async (r) => { if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Failed to load trend."); } return r.json(); })
      .then((d) => setTrend(d.series || []))
      .catch((e) => { setTrend(null); setError(e.message); })
      .finally(() => setLoading(false));
  }, [mode, userId]);

  return (
    <div className="space-y-4">
      {/* selectors */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Year</label>
          <select disabled={mode === "trend"} value={year ?? ""} onChange={(e) => setYear(parseInt(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-300">
            {years.length === 0 && <option>—</option>}
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Semester</label>
          <select disabled={mode === "trend"} value={half} onChange={(e) => setHalf(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-300">
            <option value="MID">H1 (Mid Year)</option>
            <option value="END">H2 (End Year)</option>
          </select>
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setMode("period")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${mode === "period" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>By period</button>
          <button onClick={() => setMode("trend")} className={`px-3 py-2 rounded-lg text-sm font-semibold ${mode === "trend" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Trend / Overall</button>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-400">Loading…</div>}
      {error && !loading && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">{error}</div>}

      {/* TREND */}
      {!loading && !error && mode === "trend" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-slate-700 mb-1">360 score progression</p>
          <p className="text-[11px] text-slate-400 mb-3">Thick line = overall score; thin lines = per category.</p>
          {!trend || trend.length === 0 ? (
            <p className="text-sm text-slate-400">No data to display yet.</p>
          ) : (
            <>
              <TrendChart series={trend} />
              <div className="flex flex-wrap gap-3 mt-2">
                <Legend color="#0d9488" label="Overall" bold />
                {Object.keys(CAT_COLOR).map((c) => <Legend key={c} color={CAT_COLOR[c]} label={CAT_LABEL[c]} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* PERIOD */}
      {!loading && !error && mode === "period" && !selectedPeriod && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-500 text-sm">This period has not been created yet. Choose another year/semester.</div>
      )}
      {!loading && !error && mode === "period" && data && <SingleReport data={data} />}
    </div>
  );
}

function Legend({ color, label, bold }: { color: string; label: string; bold?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <span className="inline-block rounded" style={{ width: 14, height: bold ? 3 : 2, background: color }} />
      {label}
    </span>
  );
}

function SingleReport({ data }: { data: SinglePayload }) {
  const { person, report, period, comments } = data;
  const tgt = report.targetLevel;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 border-b-2 border-teal-500 pb-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{person.name}</h2>
          <p className="text-sm text-slate-400">{person.position || "—"} · {person.department || "—"}{tgt ? ` · target L${tgt}` : ""}</p>
        </div>
        <span className="text-xs text-slate-400">{period.name}</span>
      </div>

      {!report.hasData ? (
        <div className="text-sm text-slate-500">No assessments submitted for this period yet.</div>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-1 flex-wrap">
            <span className="text-4xl font-extrabold text-teal-700">{fmt(report.overall)}</span>
            <span className={`text-xs font-bold px-2 py-1 rounded ${bandClass[report.overallBand.color] || bandClass.slate}`}>{report.overallBand.label}</span>
            <span className="text-xs text-slate-400">overall score{tgt ? ` (target L${tgt})` : ""}</span>
          </div>

          <div className="space-y-3 mt-4">
            {report.categories.map((cat) => (
              <div key={cat.category}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-600">{cat.label}</span>
                  <span className="text-slate-400">{fmt(cat.score)}{tgt ? ` / L${tgt}` : ""}</span>
                </div>
                <Bar value={cat.score} target={tgt} />
              </div>
            ))}
          </div>
          {tgt && <p className="text-[11px] text-slate-400 mt-2 text-right">Red line = target level L{tgt}</p>}

          {report.categories.map((cat) => (
            <div key={cat.category} className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700 mb-2">{cat.label}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 text-left">
                      <th className="py-1.5 pr-2 font-semibold">Competency</th>
                      <th className="py-1.5 px-1 font-semibold text-center">Superordinate</th>
                      <th className="py-1.5 px-1 font-semibold text-center">Peers</th>
                      <th className="py-1.5 px-1 font-semibold text-center">Subordinates</th>
                      <th className="py-1.5 px-1 font-semibold text-center">Self</th>
                      <th className="py-1.5 px-1 font-semibold text-center">Weighted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.comps.map((c) => (
                      <tr key={c.competencyId} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2 text-slate-700">{c.name}</td>
                        <td className="py-1.5 px-1 text-center text-slate-500">{fmt(c.groups.SUPERORDINATE)}</td>
                        <td className="py-1.5 px-1 text-center text-slate-500">{fmt(c.groups.PEER)}</td>
                        <td className="py-1.5 px-1 text-center text-slate-500">{fmt(c.groups.SUBORDINATE)}</td>
                        <td className="py-1.5 px-1 text-center text-slate-400">{fmt(c.groups.SELF)}</td>
                        <td className="py-1.5 px-1 text-center font-bold text-teal-700">{fmt(c.weighted)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {comments[cat.category] && comments[cat.category].length > 0 && (
                <div className="mt-2 bg-slate-50 rounded-lg p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500">Qualitative notes (anonymous):</p>
                  {comments[cat.category].map((cm, i) => (
                    <p key={i} className="text-[12px] text-slate-600 border-l-2 border-teal-300 pl-2">“{cm}”</p>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Recommendation report={report} comments={comments} personName={person.name} />

          <p className="text-[11px] text-slate-400 mt-3">
            Weighted score = Superordinate 40% · Peers 30% · Subordinates 30% (Self shown for context only). Rater identities are confidential — scores & notes are shown without names.
          </p>
        </>
      )}
    </div>
  );
}

// Auto-generated development recommendation, modeled on the PRIEDS 360 report:
// a Performance Overview narrative, numbered Areas for Development, and the
// anonymous qualitative feedback from raters.
function Recommendation({ report, comments, personName }: { report: Report; comments: Record<string, string[]>; personName: string }) {
  const tgt = report.targetLevel;
  const scoredCats = report.categories.filter((c) => c.score != null);
  if (!scoredCats.length) return null;

  const firstName = (personName || "This employee").split(" ")[0];
  const sorted = [...scoredCats].sort((a, b) => (b.score as number) - (a.score as number));
  const strongest = sorted.slice(0, 2);
  const belowTarget = scoredCats.filter((c) => (tgt == null ? (c.score as number) < 3 : (c.score as number) < tgt));
  const allComps = report.categories.flatMap((c) => c.comps).filter((c) => c.weighted != null);
  const weakest = [...allComps].sort((a, b) => (a.weighted as number) - (b.weighted as number)).slice(0, 3);
  const meetsAll = belowTarget.length === 0;

  const overview =
    `${firstName} achieved an overall weighted score of ${fmt(report.overall)} (${report.overallBand.label})` +
    (tgt ? ` against an L${tgt} target.` : ".") +
    (strongest.length
      ? ` The strongest results come from ${strongest.map((c) => `${c.label} (${fmt(c.score)})`).join(" and ")}, indicating this is where colleagues consistently see ${firstName} at their best.`
      : "") +
    (meetsAll
      ? ` All competency categories are at or above the expected level for this role.`
      : ` However, ${belowTarget.map((c) => `${c.label} (${fmt(c.score)})`).join(", ")} ${belowTarget.length > 1 ? "are" : "is"} still below the expected level and should be the priority for the next cycle.`);

  const devItems = (belowTarget.length
    ? report.categories
        .filter((c) => belowTarget.some((b) => b.category === c.category))
        .flatMap((c) => c.comps)
        .filter((c) => c.weighted != null && (tgt == null ? (c.weighted as number) < 3 : (c.weighted as number) < tgt))
        .sort((a, b) => (a.weighted as number) - (b.weighted as number))
        .slice(0, 4)
    : weakest
  ).map((c) => ({
    name: c.name,
    score: c.weighted as number,
    text: belowTarget.length
      ? `Currently at ${fmt(c.weighted)}${tgt ? ` vs the L${tgt} target` : ""} — agree on concrete actions in the IDP and review progress in 1-on-1s.`
      : `The lowest-scored area (${fmt(c.weighted)}) even though the target is met — a stretch-growth opportunity for the next cycle.`,
  }));

  const hasComments = Object.values(comments).some((arr) => arr && arr.length > 0);

  return (
    <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden">
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-800">💡 Recommendation</p>
        <p className="text-[11px] text-slate-400">Summary of this 360 cycle — overview, development focus, and what raters said.</p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700 mb-1">Performance Overview</p>
          <p className="text-sm text-slate-600 leading-relaxed">{overview}</p>
        </div>
        {devItems.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-red-500 mb-1">Areas for Development</p>
            <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">
              {devItems.map((d) => (
                <li key={d.name}>
                  <span className="font-semibold">{d.name}:</span> {d.text}
                </li>
              ))}
            </ol>
          </div>
        )}
        {hasComments ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Feedback summary (anonymous)</p>
            <div className="space-y-2">
              {Object.entries(comments).filter(([, arr]) => arr && arr.length).map(([cat, arr]) => {
                const sum = summarizeComments(arr);
                return (
                  <div key={cat}>
                    <p className="text-[11px] font-semibold text-slate-400">{CAT_LABEL[cat] ?? cat} · {arr.length} rater{arr.length > 1 ? "s" : ""}</p>
                    {sum.strengths && <p className="text-[13px] text-slate-600"><span className="font-semibold text-emerald-600">Strengths:</span> {sum.strengths}</p>}
                    {sum.improve && <p className="text-[13px] text-slate-600"><span className="font-semibold text-amber-600">To improve:</span> {sum.improve}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">No qualitative feedback was submitted in this cycle yet.</p>
        )}
      </div>
    </div>
  );
}

// Extractive summary of qualitative feedback: split every comment into clauses,
// bucket them into strengths vs improvement points, dedupe, and keep it short.
const IMPROVE_HINT = /(should|could|needs?|improve|recommend|next level|next step|develop|invest|focus|push|prioriti|rather than|instead of|avoid|work on|belum|perlu)/i;
function summarizeComments(arr: string[]): { strengths: string; improve: string } {
  const strengths: string[] = [];
  const improve: string[] = [];
  const seen = new Set<string>();
  for (const c of arr) {
    for (let clause of c.split(/[;.]\s+|\.$/)) {
      clause = clause.trim().replace(/^[-–—•\s]+/, "");
      if (clause.length < 12) continue;
      const key = clause.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      (IMPROVE_HINT.test(clause) ? improve : strengths).push(clause);
    }
  }
  const join = (list: string[]) => {
    const top = list.slice(0, 3).map((t) => t.charAt(0).toLowerCase() + t.slice(1));
    let out = top.join("; ");
    if (out) out = out.charAt(0).toUpperCase() + out.slice(1) + ".";
    if (list.length > 3) out += ` (+${list.length - 3} more)`;
    return out;
  };
  return { strengths: join(strengths), improve: join(improve) };
}
