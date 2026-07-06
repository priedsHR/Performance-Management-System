"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const bandClass: Record<string, string> = {
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
  teal: "bg-teal-50 text-teal-700",
  green: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-500",
};

interface Period {
  id: string;
  name: string;
  isActive: boolean;
  releaseReports: boolean;
}
interface Row {
  userId: string;
  name: string;
  department: string | null;
  overall: number | null;
  band: { key: string; label: string; color: string };
  responseCount: number;
  hasData: boolean;
}

export default function Dashboard360() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"fill" | "reset" | null>(null);
  const [toolMsg, setToolMsg] = useState("");

  function reloadRows(id: string) {
    setLoading(true);
    fetch(`/api/feedback/report?all=1&periodId=${id}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []))
      .finally(() => setLoading(false));
  }

  async function toggleRelease() {
    const period = periods.find((p) => p.id === periodId);
    if (!period) return;
    const next = !period.releaseReports;
    if (!confirm(next ? "Release reports? Employees will be able to see their own 360 report." : "Hide reports from employees again?")) return;
    await fetch(`/api/feedback/periods/${period.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseReports: next }),
    });
    const ps: Period[] = await fetch("/api/feedback/periods").then((r) => r.json());
    setPeriods(ps);
    setToolMsg(next ? "Reports released ✓ — employees can now open My Report." : "Reports hidden from employees.");
  }

  async function runTool(action: "fill" | "reset") {
    if (action === "fill" && !confirm("Fill this period with random simulated answers for all employees?")) return;
    if (
      action === "reset" &&
      !confirm(
        "Clear ALL answers & notes for this period (including real ones) and remove demo employees?\n\nForms will be empty and ready to send to employees."
      )
    )
      return;
    setBusy(action);
    setToolMsg("");
    const res = await fetch("/api/feedback/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, periodId }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setToolMsg(d.message || d.error || (res.ok ? "Done." : "Failed."));
    reloadRows(periodId);
  }

  useEffect(() => {
    fetch("/api/feedback/periods")
      .then((r) => r.json())
      .then((ps: Period[]) => {
        setPeriods(ps);
        const active = ps.find((p) => p.isActive) || ps[0];
        if (active) setPeriodId(active.id);
      });
  }, []);

  useEffect(() => {
    if (!periodId) return;
    setLoading(true);
    fetch(`/api/feedback/report?all=1&periodId=${periodId}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []))
      .finally(() => setLoading(false));
  }, [periodId]);

  const period = periods.find((p) => p.id === periodId);
  const total = rows.length;
  const withData = rows.filter((r) => r.hasData).length;
  const scored = rows.filter((r) => r.overall != null).map((r) => r.overall as number);
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

  const bandCounts: Record<string, { label: string; color: string; n: number }> = {};
  rows.forEach((r) => {
    if (!r.hasData) return;
    const k = r.band.key;
    bandCounts[k] = bandCounts[k] || { label: r.band.label, color: r.band.color, n: 0 };
    bandCounts[k].n++;
  });

  const byDept: Record<string, number[]> = {};
  rows.forEach((r) => {
    if (r.overall == null) return;
    const d = r.department || "—";
    (byDept[d] ??= []).push(r.overall);
  });

  if (periods.length === 0)
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">
        No periods yet. Create & activate a period in the <b>Periods</b> menu to get started.
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Period</label>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {period && (
            <button
              onClick={toggleRelease}
              title="Click to toggle report visibility for employees"
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition ${period.releaseReports ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
            >
              {period.releaseReports ? "🔓 Reports released — click to hide" : "📊 Release Reports"}
            </button>
          )}
          <button
            onClick={() => runTool("fill")}
            disabled={busy !== null || !periodId}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy === "fill" ? "⏳ Simulating…" : "⚡ Simulate responses"}
          </button>
          <button
            onClick={() => runTool("reset")}
            disabled={busy !== null || !periodId}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            {busy === "reset" ? "⏳ Resetting…" : "↺ Reset answers"}
          </button>
        </div>
      </div>
      {toolMsg && <div className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">{toolMsg}</div>}

      {loading ? (
        <div className="text-sm text-slate-400">Calculating…</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Stat label="Active employees" value={String(total)} />
            <Stat label="Assessed" value={`${withData} / ${total}`} />
            <Stat label="Average score" value={avg == null ? "—" : avg.toFixed(2)} accent />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Band distribution</p>
            {withData === 0 ? (
              <p className="text-sm text-slate-400">No data for this period yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.values(bandCounts).map((b) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded w-40 ${bandClass[b.color] || bandClass.slate}`}>{b.label}</span>
                    <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-teal-400" style={{ width: `${(b.n / withData) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">{b.n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Average per department</p>
            {Object.keys(byDept).length === 0 ? (
              <p className="text-sm text-slate-400">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byDept).map(([d, arr]) => {
                  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
                  return (
                    <div key={d} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 w-32 truncate">{d}</span>
                      <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: `${(m / 4) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-teal-700 w-10 text-right">{m.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link href="/360/admin/reports" className="inline-block text-sm font-semibold text-teal-700 hover:underline">
            View full report recap →
          </Link>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${accent ? "text-teal-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
