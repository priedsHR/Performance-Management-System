"use client";

import { useEffect, useState } from "react";

interface Opt { id: string; name: string; isActive: boolean }
interface Row {
  userId: string; name: string; position: string | null; department: string | null;
  score360: number | null; okr: number | null; potential: number | null; performance: number | null;
}

// [potential][performance] per the PRIEDS concept deck
const BOXES: { label: string; action: string }[][] = [
  [
    { label: "Bad Hire", action: "Identify personal roadblocks; 1-on-1 to find a more suitable assignment (mutation)." },
    { label: "Up or Out Grinder", action: "Create a PIP with clear expectations; provide training & development classes." },
    { label: "Solid Performer", action: "Identify roadblocks; increase benefits, engagement and communication." },
  ],
  [
    { label: "Up or Out Dilemma", action: "Check onboarding/product knowledge & mentoring gaps; set a PIP with clear expectations." },
    { label: "Core Player", action: "Keep engaged with regular check-ins; provide challenges like job rotation." },
    { label: "High Performer", action: "Keep them happy and appreciated; expose them to different parts of the division." },
  ],
  [
    { label: "Potential Gem", action: "Look after them: identify roadblocks, increase engagement and communication." },
    { label: "High Potential", action: "Give time & challenges to fully develop in the role; regular check-ins." },
    { label: "Star", action: "Future leaders: challenge with higher-level roles and rewards; key for succession." },
  ],
];
const BOX_COLOR = [
  ["bg-red-50 border-red-200", "bg-amber-50 border-amber-200", "bg-slate-50 border-slate-200"],
  ["bg-amber-50 border-amber-200", "bg-teal-50 border-teal-200", "bg-teal-50 border-teal-200"],
  ["bg-slate-50 border-slate-200", "bg-teal-50 border-teal-200", "bg-emerald-50 border-emerald-300"],
];

export default function NineBox({ periods, quarters }: { periods: Opt[]; quarters: Opt[] }) {
  const [periodId, setPeriodId] = useState(periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? "");
  const [quarterId, setQuarterId] = useState(quarters.find((q) => q.isActive)?.id ?? quarters[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [openBox, setOpenBox] = useState<string | null>(null);

  useEffect(() => {
    if (!periodId || !quarterId) return;
    setLoading(true);
    fetch(`/api/ninebox?periodId=${periodId}&quarterId=${quarterId}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []))
      .finally(() => setLoading(false));
  }, [periodId, quarterId]);

  const placed = rows.filter((r) => r.potential != null && r.performance != null);
  const unplaced = rows.filter((r) => r.potential == null || r.performance == null);
  const grid: Row[][][] = [0, 1, 2].map((p) => [0, 1, 2].map(() => []));
  placed.forEach((r) => grid[r.potential as number][r.performance as number].push(r));

  const sel = "border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-400 mb-1">360 Period (potential)</label>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className={sel}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? " (active)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">OKR Quarter (performance)</label>
          <select value={quarterId} onChange={(e) => setQuarterId(e.target.value)} className={sel}>
            {quarters.map((q) => <option key={q.id} value={q.id}>{q.name}{q.isActive ? " (active)" : ""}</option>)}
          </select>
        </div>
        {loading && <span className="text-sm text-slate-400 pb-2">Calculating…</span>}
      </div>

      {/* Grid: potential rows top=High(2) → bottom=Low(0); performance cols left=Low(0) → right=High(2) */}
      <div className="grid" style={{ gridTemplateColumns: "auto 1fr 1fr 1fr" }}>
        {[2, 1, 0].map((pot) => (
          <div key={pot} className="contents">
            <div className="flex items-center justify-center px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                {pot === 2 ? "High" : pot === 1 ? "Moderate" : "Low"} potential
              </span>
            </div>
            {[0, 1, 2].map((perf) => {
              const box = BOXES[pot][perf];
              const key = `${pot}-${perf}`;
              const people = grid[pot][perf];
              return (
                <button key={key} onClick={() => setOpenBox(openBox === key ? null : key)}
                  className={`m-1 rounded-xl border p-3 text-left min-h-[110px] transition hover:shadow ${BOX_COLOR[pot][perf]}`}>
                  <p className="text-xs font-bold text-slate-700">{box.label} <span className="text-slate-400 font-normal">({people.length})</span></p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {people.map((r) => (
                      <span key={r.userId} title={`360: ${r.score360?.toFixed(2)} · OKR: ${r.okr?.toFixed(0)}%`}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-600">
                        {r.name.split(" ").slice(0, 2).join(" ")}
                      </span>
                    ))}
                  </div>
                  {openBox === key && <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-200 pt-1.5">{box.action}</p>}
                </button>
              );
            })}
          </div>
        ))}
        <div />
        {["Low", "Moderate", "High"].map((l) => (
          <div key={l} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">{l} performance</div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">Click a box to see its recommended action plan. Hover a name for their exact scores.</p>

      {unplaced.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Not placed yet (missing 360 score or OKR data):</p>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map((r) => (
              <span key={r.userId} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                {r.name} {r.score360 == null ? "· no 360" : ""} {r.okr == null ? "· no OKR" : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
