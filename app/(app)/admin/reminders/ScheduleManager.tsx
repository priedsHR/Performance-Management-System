"use client";

import { useState } from "react";
import YearQuarterPicker from "@/components/YearQuarterPicker";

type Quarter = { id: string; name: string; year: number; quarter: number; isActive: boolean };
type Schedule = {
  id: string;
  type: string;
  quarterId: string;
  quarter: { id: string; name: string };
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hourWIB: number;
  isActive: boolean;
  lastRun: string | null;
  nextRun: string;
};

const DAYS = ["Week", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const TYPE_LABEL: Record<string, string> = { settings: "🎯 Setting OKR", collection: "📋 Pengumpulan" };
const FREQ_LABEL: Record<string, string> = { weekly: "Every Week", biweekly: "Every 2 Weeks", monthly: "Every Month" };

function fmtWIB(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scheduleDesc(s: Schedule) {
  const freq = FREQ_LABEL[s.frequency] ?? s.frequency;
  if (s.frequency === "monthly") return `${freq}, tgl ${s.dayOfMonth}, jam ${String(s.hourWIB).padStart(2, "0")}:00 WIB`;
  return `${freq}, day ${DAYS[s.dayOfWeek ?? 0]}, jam ${String(s.hourWIB).padStart(2, "0")}:00 WIB`;
}

export default function ScheduleManager({ quarters, initialSchedules }: { quarters: Quarter[]; initialSchedules: Schedule[] }) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [type, setType] = useState("settings");
  const [quarterId, setQuarterId] = useState(quarters.find(q => q.isActive)?.id ?? quarters[0]?.id ?? "");
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Senin
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hourWIB, setHourWIB] = useState(9);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reminder-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, quarterId, frequency,
          dayOfWeek: frequency !== "monthly" ? dayOfWeek : undefined,
          dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
          hourWIB,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      setSchedules((prev) => [data, ...prev]);
    } catch {
      setError("A network error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/admin/reminder-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule?")) return;
    const res = await fetch(`/api/admin/reminder-schedules/${id}`, { method: "DELETE" });
    if (res.ok) setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4">➕ Buat Schedule Otomatis</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {/* Type */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Tipe Reminder</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="settings">🎯 Setting OKR</option>
              <option value="collection">📋 Pengumpulan</option>
            </select>
          </div>

          {/* Quarter */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Quarter</label>
            <YearQuarterPicker quarters={quarters} value={quarterId} onChange={setQuarterId} />
          </div>

          {/* Frequency */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Frekuensi</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="weekly">Every Week</option>
              <option value="biweekly">Every 2 Weeks</option>
              <option value="monthly">Every Month</option>
            </select>
          </div>

          {/* Day / Date */}
          {frequency !== "monthly" ? (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Hari</label>
              <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Date</label>
              <select value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* Hour */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Jam (WIB)</label>
            <select value={hourWIB} onChange={e => setHourWIB(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {Array.from({ length: 24 }, (_, i) => i).map(h => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="flex items-end col-span-2 md:col-span-1">
            <button type="submit" disabled={saving || !quarterId}
              className="w-full flex items-center justify-center gap-2 bg-amber-400 text-white font-bold text-sm px-5 py-2 rounded-xl
                shadow-[0_4px_0_#097eb9] hover:shadow-[0_2px_0_#097eb9] hover:translate-y-0.5
                active:shadow-none active:translate-y-1 disabled:opacity-50 disabled:shadow-none transition-all duration-75">
              {saving ? "⏳ Saving..." : "💾 Save Schedule"}
            </button>
          </div>
        </form>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          No schedule otomatis. Buat schedule di atas.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <p className="font-semibold text-slate-700 text-sm">🗓️ Schedule Active ({schedules.length})</p>
          </div>
          <div className="divide-y divide-slate-50">
            {schedules.map((s) => (
              <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 ${!s.isActive ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-slate-700">{TYPE_LABEL[s.type] ?? s.type}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{s.quarter.name}</span>
                  </div>
                  <p className="text-xs text-slate-500">{scheduleDesc(s)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Berikutnya: <span className="font-medium text-slate-600">{fmtWIB(s.nextRun)}</span>
                    {s.lastRun && <> · Terakhir: {fmtWIB(s.lastRun)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle */}
                  <button onClick={() => toggleActive(s.id, s.isActive)}
                    className={`text-xs font-semibold px-3 py-1 rounded-lg border transition ${
                      s.isActive
                        ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}>
                    {s.isActive ? "✅ Active" : "⏸️ Inactive"}
                  </button>
                  {/* Delete */}
                  <button onClick={() => handleDelete(s.id)}
                    className="text-xs font-semibold px-3 py-1 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
