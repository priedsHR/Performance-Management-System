"use client";

import { useEffect, useState } from "react";

interface Row {
  userId: string; name: string; department: string | null; position: string | null;
  assigned: number; done: number; complete: boolean;
}

// Admin tracker: who has finished all their 360 submissions and who is still pending.
export default function SubmissionStatus({ periodId }: { periodId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [completed, setCompleted] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  useEffect(() => {
    if (!periodId) return;
    setRows(null);
    fetch(`/api/feedback/submission-status?periodId=${periodId}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows || []); setCompleted(d.completed || 0); });
  }, [periodId]);

  if (rows === null)
    return <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-40" />;

  const shown = rows
    .filter((r) => (filter === "pending" ? !r.complete : filter === "done" ? r.complete : true))
    .filter((r) => {
      const t = q.trim().toLowerCase();
      return !t || [r.name, r.department, r.position].some((v) => (v || "").toLowerCase().includes(t));
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">Submission status</p>
          <p className="text-[11px] text-slate-400">Who has finished filling in their assigned 360 feedback.</p>
        </div>
        <span className="text-sm font-semibold text-[#097eb9]">{completed} / {rows.length} done</span>
      </div>

      <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / department…"
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px]" />
        <div className="flex bg-slate-100 p-1 rounded-lg gap-0.5 text-xs font-semibold">
          {(["all", "pending", "done"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md capitalize transition ${filter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {f === "all" ? `All (${rows.length})` : f === "pending" ? `Pending (${rows.length - completed})` : `Done (${completed})`}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-400 text-xs">
          <tr>
            <th className="text-left px-5 py-2 font-semibold">Employee</th>
            <th className="text-left px-3 py-2 font-semibold">Department</th>
            <th className="text-center px-3 py-2 font-semibold">Progress</th>
            <th className="text-right px-5 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.userId} className="border-t border-slate-100">
              <td className="px-5 py-2.5">
                <p className="font-medium text-slate-700">{r.name}</p>
                <p className="text-[11px] text-slate-400">{r.position || "—"}</p>
              </td>
              <td className="px-3 py-2.5 text-slate-500 text-xs">{r.department || "—"}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-20 h-1.5 bg-slate-100 rounded overflow-hidden">
                    <div className={`h-full ${r.complete ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${r.assigned ? (r.done / r.assigned) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums">{r.done}/{r.assigned}</span>
                </div>
              </td>
              <td className="px-5 py-2.5 text-right">
                {r.complete
                  ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">✓ Done</span>
                  : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>}
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-6 text-center text-sm text-slate-400">No employees match.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
