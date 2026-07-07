"use client";

import { useState, useEffect } from "react";

type Period = { id: string; name: string; half: string; year: number; isActive: boolean };
type SendResult = { name: string; email: string; status: "sent" | "skipped" | "error"; reason?: string; error?: string };

const btnTeal =
  "flex items-center gap-2 bg-teal-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl " +
  "shadow-sm hover:shadow-sm " +
  "active:shadow-sm " +
  "disabled:opacity-50 transition-all duration-75";

const btnSlate =
  "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-xl " +
  "shadow-sm hover:shadow-sm " +
  "active:shadow-sm transition-all duration-75";

export default function Reminder360Manager({
  periods,
}: {
  periods: Period[];
}) {
  const activePeriod = periods.find((p) => p.isActive) ?? periods[0];
  const [selectedPeriodId, setSelectedPeriodId] = useState(activePeriod?.id ?? "");
  const [sending, setSending] = useState<"initial" | "followup" | "test" | null>(null);
  const [result, setResult] = useState<{ type: "initial" | "followup" | "test"; message: string; results: SendResult[]; success: boolean } | null>(null);

  useEffect(() => {
    setResult(null);
  }, [selectedPeriodId]);

  async function sendReminder(type: "initial" | "followup", test = false) {
    if (!selectedPeriodId) return;
    setSending(test ? "test" : type);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-reminder-360", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, periodId: selectedPeriodId, test }),
      });
      const data = await res.json();
      setResult({ type: test ? "test" : type, message: data.message ?? (res.ok ? "Sent." : "Failed."), results: data.results ?? [], success: data.success ?? res.ok });
    } catch {
      setResult({ type: test ? "test" : type, message: "A network error occurred.", results: [], success: false });
    } finally {
      setSending(null);
    }
  }

  if (periods.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="text-4xl mb-3"></div>
        <p className="text-slate-500 text-sm">No 360 Feedback periods yet. Create a period first in the Periods menu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Period</label>
        <select
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 w-full max-w-xs"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.isActive ? " (Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Trial send to my own email */}
      <div className="bg-[#eef9fd] border border-[#b7e7f7] rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-bold text-slate-800 text-sm">Trial — send to my email first</p>
          <p className="text-xs text-slate-500 mt-0.5">Sends ONE test email to your own inbox (subject prefixed [TEST]) so you can check the layout before blasting everyone.</p>
        </div>
        <button
          onClick={() => sendReminder("initial", true)}
          disabled={!selectedPeriodId || sending !== null}
          className={btnSlate}
        >
          {sending === "test" ? "Sending…" : "Send test to me"}
        </button>
      </div>

      {/* Reminder cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl"></span>
              <h3 className="font-bold text-slate-800">Completion Reminder</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Email everyone who still has unfinished 360° assessments in this period.
              Best sent at the <strong>start or middle of the period</strong>.
            </p>
          </div>
          <button
            onClick={() => sendReminder("initial")}
            disabled={!selectedPeriodId || sending !== null}
            className={btnTeal}
          >
            {sending === "initial" ? "Sending..." : "Send Completion Reminder"}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl"></span>
              <h3 className="font-bold text-slate-800">Follow Up</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send a more urgent follow-up to those who are <strong>still not done</strong>.
              Best sent <strong>near the end of the period</strong>.
            </p>
          </div>
          <button
            onClick={() => sendReminder("followup")}
            disabled={!selectedPeriodId || sending !== null}
            className={btnSlate}
          >
            {sending === "followup" ? "Sending..." : "Send Follow Up"}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-2xl border p-5 space-y-3 ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className={`font-semibold text-sm ${result.success ? "text-green-700" : "text-red-700"}`}>
            {result.success ? "" : ""}{" "}
            {result.type === "test" ? "Test Email" : result.type === "initial" ? "Completion Reminder" : "Follow Up"} — {result.message}
          </p>
          {result.results.length > 0 && (
            <div className="space-y-1">
              {result.results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={r.status === "sent" ? "text-green-600" : r.status === "skipped" ? "text-slate-400" : "text-red-500"}>
                    {r.status === "sent" ? "" : r.status === "skipped" ? "—" : ""}
                  </span>
                  <span className="font-medium text-slate-700">{r.name}</span>
                  <span className="text-slate-400">{r.email}</span>
                  {r.status === "skipped" && <span className="text-slate-400">{r.reason}</span>}
                  {r.error && <span className="text-red-500">— {r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
