"use client";

import { useEffect, useState } from "react";
import { LEVELS } from "@/lib/feedback/library";

interface Band { key: string; label: string; max: number; color: string }
interface Settings { weightSuper: number; weightPeer: number; weightSub: number; bands: Band[]; levelTargets: Record<string, number> }

const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white transition";
const btnPrimary = "flex items-center gap-2 bg-amber-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0_#097eb9] hover:shadow-[0_2px_0_#097eb9] hover:translate-y-0.5 active:shadow-[0_1px_0_#097eb9] active:translate-y-[3px] disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 transition-all duration-75";

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-48 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function SettingsManager() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/feedback/settings").then((r) => r.json()).then(setS);
  }, []);

  if (!s) return (
    <div className="space-y-4">
      <SkeletonCard rows={3} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
    </div>
  );

  const sum = (s.weightSuper + s.weightPeer + s.weightSub).toFixed(2);
  const sumOk = Math.abs(parseFloat(sum) - 1) < 0.01;

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/feedback/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    setMsg(res.ok ? "✅ Saved." : "❌ Failed to save.");
  }

  return (
    <div className="space-y-4">
      {/* Weights */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="font-semibold text-slate-800 mb-1">⚖️ Rater Group Weights</p>
        <p className="text-xs text-slate-400 mb-4">Self carries no weight (context only). Ideal total = 1.00. Current total:{" "}
          <span className={`font-semibold ${sumOk ? "text-green-600" : "text-red-500"}`}>{sum}</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {([["Superordinate (Manager)", "weightSuper"], ["Peer", "weightPeer"], ["Subordinate", "weightSub"]] as const).map(([label, key]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={s[key]}
                onChange={(e) => setS({ ...s, [key]: parseFloat(e.target.value) || 0 })}
                className={inp}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Level targets */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="font-semibold text-slate-800 mb-1">🎯 Target Level per Career Level</p>
        <p className="text-xs text-slate-400 mb-4">The expected target score (1–4) for each career level.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {LEVELS.map((lv) => (
            <div key={lv}>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{lv}</label>
              <select
                value={s.levelTargets[lv] ?? 1}
                onChange={(e) => setS({ ...s, levelTargets: { ...s.levelTargets, [lv]: parseInt(e.target.value) } })}
                className={inp}
              >
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>L{n}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Bands */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="font-semibold text-slate-800 mb-1">📊 Scoring Bands</p>
        <p className="text-xs text-slate-400 mb-4">A score falls into the first band whose upper bound is greater than the score. The last band is the highest bound.</p>
        <div className="space-y-2">
          {s.bands.map((b, i) => (
            <div key={b.key} className="flex items-center gap-3">
              <input
                value={b.label}
                onChange={(e) => { const bands = [...s.bands]; bands[i] = { ...b, label: e.target.value }; setS({ ...s, bands }); }}
                placeholder="Band name"
                className={`${inp} flex-1`}
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">upper bound &lt;</span>
              <input
                type="number"
                step="0.1"
                value={b.max}
                onChange={(e) => { const bands = [...s.bands]; bands[i] = { ...b, max: parseFloat(e.target.value) || 0 }; setS({ ...s, bands }); }}
                className={`${inp} w-24`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? "⏳ Saving..." : "💾 Save Settings"}
        </button>
        {msg && <span className={`text-sm font-medium ${msg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{msg}</span>}
      </div>
    </div>
  );
}
