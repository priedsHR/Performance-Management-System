"use client";

import { useState, useEffect } from "react";
import YearQuarterPicker from "@/components/YearQuarterPicker";

type Quarter = { id: string; name: string; year: number; quarter: number; isActive: boolean };
type LeadStatus = "complete" | "incomplete" | "empty";
type Lead = {
  id: string;
  name: string;
  email: string;
  division: string | null;
  settingsStatus: LeadStatus;
  collectionStatus: LeadStatus;
};
type SendResult = { name: string; email: string; status: "sent" | "skipped" | "error"; reason?: string; error?: string };

function StatusBadge({ status }: { status: LeadStatus }) {
  if (status === "complete")
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg">Complete</span>;
  if (status === "incomplete")
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">Incomplete</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">Not created yet</span>;
}

const btnAmber =
  "flex items-center gap-2 bg-[#0b8ec4] text-white hover:bg-[#097eb9] font-bold text-sm px-5 py-2.5 rounded-xl " +
  "shadow-sm hover:shadow-sm " +
  "active:shadow-sm " +
  "disabled:opacity-50 transition-all duration-75";

const btnSlate =
  "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-xl " +
  "shadow-sm hover:shadow-sm " +
  "active:shadow-sm transition-all duration-75";

export default function ReminderManager({
  quarters,
  initialLeads,
}: {
  quarters: Quarter[];
  initialLeads: Lead[];
}) {
  const activeQuarter = quarters.find((q) => q.isActive) ?? quarters[0];
  const [selectedQuarterId, setSelectedQuarterId] = useState(activeQuarter?.id ?? "");
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [sending, setSending] = useState<"settings" | "collection" | null>(null);
  const [result, setResult] = useState<{ type: "settings" | "collection"; message: string; results: SendResult[]; success: boolean } | null>(null);

  const selectedQuarter = quarters.find((q) => q.id === selectedQuarterId);

  useEffect(() => {
    if (!selectedQuarterId) return;
    // Active quarter already loaded from server, skip initial fetch
    if (selectedQuarterId === (activeQuarter?.id ?? "")) {
      setLeads(initialLeads);
      return;
    }
    setLoadingLeads(true);
    fetch(`/api/admin/lead-statuses?quarterId=${selectedQuarterId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setLeads(data); })
      .finally(() => setLoadingLeads(false));
  }, [selectedQuarterId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendReminder(type: "settings" | "collection") {
    if (!selectedQuarterId) return;
    setSending(type);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, quarterId: selectedQuarterId }),
      });
      const data = await res.json();
      setResult({ type, message: data.message ?? (res.ok ? "Sent." : "Failed."), results: data.results ?? [], success: data.success ?? res.ok });
    } catch {
      setResult({ type, message: "A network error occurred.", results: [], success: false });
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Quarter selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Quarter</label>
        <YearQuarterPicker
          quarters={quarters}
          value={selectedQuarterId}
          onChange={(id) => { setSelectedQuarterId(id); setResult(null); }}
        />
      </div>

      {/* Reminder cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Card 1: Setting OKR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl"></span>
              <h3 className="font-bold text-slate-800">Reminder Setting OKR</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Email all Division Leads to create their Objectives &amp; Key Results on the Division OKR page.
              Cocok dikirim di <strong>awal quarter</strong>.
            </p>
          </div>
          <button
            onClick={() => sendReminder("settings")}
            disabled={!selectedQuarterId || sending !== null}
            className={btnAmber}
          >
            {sending === "settings" ? "Sending..." : "Send Setup Reminder"}
          </button>
        </div>

        {/* Card 2: Pengumpulan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl"></span>
              <h3 className="font-bold text-slate-800">Submission Reminder</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cek menyeluruh di <strong>akhir quarter</strong>: weights, targets, units, member progress, and lead achievement.
              Only sends to those with incomplete data.
            </p>
          </div>
          <button
            onClick={() => sendReminder("collection")}
            disabled={!selectedQuarterId || sending !== null}
            className={btnSlate}
          >
            {sending === "collection" ? "Sending..." : "Send Submission Reminder"}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-2xl border p-5 space-y-3 ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className={`font-semibold text-sm ${result.success ? "text-green-700" : "text-red-700"}`}>
            {result.success ? "" : ""}{" "}
            {result.type === "settings" ? "Reminder Setting OKR" : "Submission Reminder"} —{" "}
            {result.message}
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

      {/* Lead list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-700 text-sm">Division Leads ({leads.length} people)</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Reminder hanya dikirim ke yang statusnya <span className="font-semibold text-amber-600">Incomplete</span> or <span className="font-semibold text-red-600">Not created yet</span>.
            </p>
          </div>
          {loadingLeads && <span className="text-xs text-slate-400 animate-pulse">Loading status...</span>}
        </div>
        {leads.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No Division Leads registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="text-left px-5 py-2.5 font-semibold">Name</th>
                <th className="text-left px-5 py-2.5 font-semibold">Email</th>
                <th className="text-left px-5 py-2.5 font-semibold">Division</th>
                <th className="text-center px-3 py-2.5 font-semibold">Setting OKR</th>
                <th className="text-center px-3 py-2.5 font-semibold">Submission</th>
              </tr>
            </thead>
            <tbody className={loadingLeads ? "opacity-40 pointer-events-none" : ""}>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3 font-medium text-slate-800">{lead.name}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{lead.email}</td>
                  <td className="px-5 py-3 text-slate-500">{lead.division ?? "—"}</td>
                  <td className="px-3 py-3 text-center"><StatusBadge status={lead.settingsStatus} /></td>
                  <td className="px-3 py-3 text-center"><StatusBadge status={lead.collectionStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
