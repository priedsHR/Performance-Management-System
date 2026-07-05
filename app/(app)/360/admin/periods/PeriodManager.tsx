"use client";

import { useEffect, useState } from "react";

interface Period {
  id: string;
  name: string;
  half: string;
  year: number;
  isActive: boolean;
  releaseReports: boolean;
}

const inp = "border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white transition";
const btnPrimary = "flex items-center gap-2 bg-amber-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0_#097eb9] hover:shadow-[0_2px_0_#097eb9] hover:translate-y-0.5 active:shadow-[0_1px_0_#097eb9] active:translate-y-[3px] disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 transition-all duration-75";
const btnSecondary = "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-4 py-2 rounded-xl shadow-[0_3px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-0.5 active:shadow-none active:translate-y-[3px] transition-all duration-75";

function SkeletonPeriod() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center justify-between animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-40" />
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-slate-100 rounded-xl" />
        <div className="h-8 w-28 bg-slate-100 rounded-xl" />
        <div className="h-8 w-14 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function PeriodManager() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [half, setHalf] = useState("MID");
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch("/api/feedback/periods");
    setPeriods(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/feedback/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ half, year }),
    });
    setBusy(false);
    if (r.ok) {
      await load();
    } else {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error || "Failed to create period.");
    }
  }

  async function patch(id: string, body: object) {
    await fetch(`/api/feedback/periods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function del(id: string) {
    if (!confirm("Delete this period along with all its assessments?")) return;
    await fetch(`/api/feedback/periods/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-slate-800 mb-3">🗓️ Create New Period</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Semester</label>
            <select value={half} onChange={(e) => setHalf(e.target.value)} className={inp}>
              <option value="MID">Mid Year</option>
              <option value="END">End Year</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className={`${inp} w-28`}
            />
          </div>
          <button onClick={create} disabled={busy} className={btnPrimary}>
            {busy ? "⏳ Creating..." : "➕ Add Period"}
          </button>
        </div>
        {msg && <p className="text-sm text-red-500 mt-2">{msg}</p>}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          <SkeletonPeriod />
          <SkeletonPeriod />
        </div>
      )}

      {/* Period list */}
      {!loading && (
        <div className="space-y-2">
          {periods.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">🗓️</div>
              <p className="text-slate-500 text-sm">No periods yet. Create the first period above.</p>
            </div>
          ) : (
            periods.map((p) => (
              <div key={p.id} className={`bg-white border rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${p.isActive ? "border-amber-200 bg-amber-50/30" : "border-slate-200"}`}>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-800 text-sm">📅 {p.name}</p>
                    {p.isActive && <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">✅ Active</span>}
                    {p.releaseReports && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">📊 Reports released</span>}
                  </div>
                  <p className="text-xs text-slate-400">{p.half === "MID" ? "Mid Year" : "End Year"} {p.year}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {!p.isActive ? (
                    <button onClick={() => patch(p.id, { isActive: true })} className={btnPrimary + " !py-2 !text-xs"}>
                      ▶️ Set Active
                    </button>
                  ) : (
                    <button onClick={() => patch(p.id, { isActive: false })} className={btnSecondary + " !text-xs"}>
                      ⏸️ Deactivate
                    </button>
                  )}
                  <button onClick={() => patch(p.id, { releaseReports: !p.releaseReports })} className={btnSecondary + " !text-xs"}>
                    {p.releaseReports ? "🔒 Hide Reports" : "📊 Release Reports"}
                  </button>
                  <button onClick={() => del(p.id)} className="text-slate-300 hover:text-red-500 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-50 shadow-[0_3px_0_#e2e8f0] hover:shadow-[0_1px_0_#fecaca] hover:translate-y-0.5 active:shadow-none transition-all duration-75">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
