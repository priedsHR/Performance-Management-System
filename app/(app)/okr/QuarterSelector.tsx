"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
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

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white transition";

export default function QuarterSelector({
  quarters,
  selectedQuarterId,
  isLead,
  basePath = "/okr",
}: {
  quarters: Quarter[];
  selectedQuarterId: string | null;
  isLead: boolean;
  basePath?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    quarter: Math.ceil((new Date().getMonth() + 1) / 3),
    startDate: "",
    endDate: "",
  });

  async function createQuarter() {
    if (!form.name || !form.startDate || !form.endDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/quarters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to create quarter");
        return;
      }
      const q = await res.json();
      setShowCreate(false);
      setForm({
        name: "",
        year: new Date().getFullYear(),
        quarter: Math.ceil((new Date().getMonth() + 1) / 3),
        startDate: "",
        endDate: "",
      });
      window.location.href = `${basePath}?quarterId=${q.id}`;
    } finally {
      setSaving(false);
    }
  }

  const selectedQuarter = quarters.find((q) => q.id === selectedQuarterId);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-slate-600 flex-shrink-0">⏱️ Quarter:</span>

        {quarters.length > 0 ? (
          <YearQuarterPicker
            quarters={quarters}
            value={selectedQuarterId ?? ""}
            onChange={(id) => { window.location.href = `${basePath}?quarterId=${id}`; }}
          />
        ) : (
          <span className="text-sm text-slate-400 italic">No quarter</span>
        )}

        {selectedQuarter && (
          <span className="text-xs text-slate-400 flex-shrink-0">
            📅 {new Date(selectedQuarter.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            {" – "}
            {new Date(selectedQuarter.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}

        {isLead && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all duration-75 flex-shrink-0 ${
              showCreate
                ? "bg-slate-100 text-slate-600"
                : "bg-amber-400 text-white shadow-[0_3px_0_#097eb9] hover:shadow-[0_1px_0_#097eb9] hover:translate-y-0.5 active:shadow-none active:translate-y-[3px]"
            }`}
          >
            {showCreate ? <X size={13} /> : <Plus size={13} />}
            {showCreate ? "Cancel" : "Create Quarter"}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-3">📋 New Quarter</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Name Quarter</label>
              <input
                className={inputCls}
                placeholder="e.g. Q1 2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tahun</label>
              <input
                type="number"
                className={inputCls}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Quarter</label>
              <select
                className={inputCls}
                value={form.quarter}
                onChange={(e) => setForm({ ...form, quarter: Number(e.target.value) })}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">📅 Start</label>
              <input
                type="date"
                className={inputCls}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">📅 End</label>
              <input
                type="date"
                className={inputCls}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={createQuarter}
            disabled={saving || !form.name || !form.startDate || !form.endDate}
            className="mt-3 flex items-center gap-2 bg-amber-400 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-[0_3px_0_#097eb9] hover:shadow-[0_1px_0_#097eb9] hover:translate-y-0.5 active:shadow-none active:translate-y-[3px] disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 transition-all duration-75"
          >
            {saving ? "⏳ Saving..." : "💾 Save Quarter"}
          </button>
        </div>
      )}
    </div>
  );
}
