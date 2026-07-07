"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronDown } from "lucide-react";
import { groupByYear } from "@/lib/quarter-group";
import YearQuarterPicker from "@/components/YearQuarterPicker";

type Quarter = {
  id: string;
  name: string;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const btnPrimary =
  "flex items-center gap-2 bg-amber-400 text-white font-bold text-sm px-4 py-2.5 rounded-xl " +
  "shadow-[0_4px_0_#097eb9] hover:shadow-[0_2px_0_#097eb9] hover:translate-y-0.5 " +
  "active:shadow-[0_1px_0_#097eb9] active:translate-y-[3px] transition-all duration-75";

const btnSecondary =
  "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-xl " +
  "shadow-[0_4px_0_#e2e8f0] hover:shadow-[0_2px_0_#e2e8f0] hover:translate-y-0.5 " +
  "active:shadow-[0_1px_0_#e2e8f0] active:translate-y-[3px] transition-all duration-75";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white transition";

export default function QuarterManager({ initialQuarters }: { initialQuarters: Quarter[] }) {
  const router = useRouter();
  const [quarters, setQuarters] = useState<Quarter[]>(initialQuarters);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", year: new Date().getFullYear(), quarter: 1, startDate: "", endDate: "",
  });

  // Collapsible years — default: expand year with active quarter, collapse rest
  const activeYear = quarters.find((q) => q.isActive)?.year ?? quarters[0]?.year;
  const [expandedYears, setExpandedYears] = useState<Set<number>>(
    new Set(activeYear ? [activeYear] : [])
  );

  // Export all divisions state
  const activeQ = quarters.find((q) => q.isActive) ?? quarters[0];
  const [exportQuarterId, setExportQuarterId] = useState(activeQ?.id ?? "");
  const [exporting, setExporting] = useState(false);

  function toggleYear(year: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  }

  async function createQuarter() {
    if (!form.name || !form.startDate || !form.endDate) return;
    const res = await fetch("/api/quarters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const q = await res.json();
    setQuarters((prev) => [q, ...prev]);
    setExpandedYears((prev) => new Set([...prev, q.year]));
    setShowForm(false);
    setForm({ name: "", year: new Date().getFullYear(), quarter: 1, startDate: "", endDate: "" });
  }

  async function toggleActive(q: Quarter) {
    const res = await fetch(`/api/quarters/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !q.isActive }),
    });
    const updated = await res.json();
    setQuarters((prev) => prev.map((x) => ({ ...x, isActive: x.id === updated.id ? updated.isActive : false })));
    router.refresh();
  }

  async function deleteQuarter(id: string) {
    if (!confirm("Delete this quarter? All OKRs in it will be permanently deleted.")) return;
    await fetch(`/api/quarters/${id}`, { method: "DELETE" });
    setQuarters((prev) => prev.filter((q) => q.id !== id));
  }

  async function exportAll() {
    if (!exportQuarterId) return;
    setExporting(true);
    try {
      const q = quarters.find((q) => q.id === exportQuarterId);
      window.location.href = `/api/admin/export-all?quarterId=${exportQuarterId}`;
      // small delay so user sees feedback before browser triggers download
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      setExporting(false);
    }
  }

  const grouped = groupByYear(quarters);

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>
          ➕ Add Quarter
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-amber-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">⏱️ New Quarter</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Name Quarter</label>
              <input className={inputCls} placeholder="e.g. Q1 2025" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Tahun</label>
              <input type="number" className={inputCls} value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Quarter (1–4)</label>
              <select className={inputCls} value={form.quarter}
                onChange={(e) => setForm({ ...form, quarter: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">📅 Start Date</label>
              <input type="date" className={inputCls} value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">📅 End Date</label>
              <input type="date" className={inputCls} value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={createQuarter} className={btnPrimary}>💾 Save</button>
            <button onClick={() => setShowForm(false)} className={btnSecondary}>✕ Cancel</button>
          </div>
        </div>
      )}

      {/* Export all divisions card */}
      {quarters.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-1">📊 Export All Division</h2>
          <p className="text-xs text-slate-400 mb-4">Download all divisions' OKR data in one Excel file (one tab per division).</p>
          <div className="flex items-center gap-3 flex-wrap">
            <YearQuarterPicker
              quarters={quarters}
              value={exportQuarterId}
              onChange={setExportQuarterId}
            />
            <button
              onClick={exportAll}
              disabled={!exportQuarterId || exporting}
              className="flex items-center gap-2 bg-emerald-500 text-white font-bold text-sm px-4 py-2 rounded-xl
                shadow-[0_3px_0_#059669] hover:shadow-[0_1px_0_#059669] hover:translate-y-0.5
                active:shadow-none active:translate-y-[3px] disabled:opacity-50 disabled:shadow-none
                disabled:translate-y-0 transition-all duration-75"
            >
              {exporting ? "⏳ Menyiapkan..." : "⬇️ Download Excel"}
            </button>
          </div>
        </div>
      )}

      {/* Quarter list grouped by year (collapsible) */}
      <div className="space-y-3">
        {quarters.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">⏱️</div>
            <p className="text-slate-500 text-sm">No quarters. Add the first quarter.</p>
          </div>
        ) : (
          grouped.map(({ year, quarters: qs }) => {
            const isOpen = expandedYears.has(year);
            const hasActive = qs.some((q) => q.isActive);
            return (
              <div key={year} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Year header — clickable */}
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-slate-700">📅 {year}</span>
                    {hasActive && (
                      <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        ✅ Active
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{qs.length} quarter</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Quarter cards */}
                {isOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {qs.map((q) => (
                      <div
                        key={q.id}
                        className={`flex items-center justify-between px-5 py-4 ${q.isActive ? "bg-amber-50/50" : ""}`}
                      >
                        <div>
                          <div className="flex items-center gap-2.5 mb-0.5">
                            <h3 className="font-semibold text-slate-800 text-sm">⏱️ {q.name}</h3>
                            {q.isActive && (
                              <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                ✅ Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            📅 {new Date(q.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} –{" "}
                            {new Date(q.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleActive(q)}
                            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-semibold transition-all duration-75 ${
                              q.isActive
                                ? "bg-amber-100 text-amber-700 shadow-[0_3px_0_#fbbf24] hover:shadow-[0_1px_0_#fbbf24] hover:translate-y-0.5 active:shadow-none active:translate-y-[3px]"
                                : "bg-white border border-slate-200 text-slate-600 shadow-[0_3px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-0.5 active:shadow-none active:translate-y-[3px]"
                            }`}
                          >
                            {q.isActive ? "✅ Active" : "▶️ Set Active"}
                          </button>
                          <button
                            onClick={() => deleteQuarter(q.id)}
                            className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50
                              shadow-[0_3px_0_#e2e8f0] hover:shadow-[0_1px_0_#fecaca] hover:translate-y-0.5
                              active:shadow-none active:translate-y-[3px] transition-all duration-75"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
