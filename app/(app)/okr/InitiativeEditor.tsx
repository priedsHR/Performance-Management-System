"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";

type Pic = { id: string; name: string } | null;
type Monthly = { year: number; month: number; actual: number };
type Initiative = {
  id: string;
  title: string;
  target: number;
  actual: number;
  unit: string;
  resultNote: string | null;
  picId: string | null;
  pic?: Pic;
  monthly?: Monthly[];
};
type TeamMember = { id: string; name: string };

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function achClass(v: number) {
  return v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
}

// Initiatives (action plans) under one Key Result. Each has a PIC (team member),
// a success-indicator target, an actual, and a Results & Evaluation note —
// mirroring the department OKR template.
export default function InitiativeEditor({
  keyResultId,
  krUnit,
  isLocked,
  onAchievement,
  year,
  months,
}: {
  keyResultId: string;
  krUnit: string;
  isLocked: boolean;
  // Reports this KR's rolled-up achievement (avg of initiatives' %), or null
  // when there are no initiatives (parent then uses its own fallback).
  onAchievement?: (pct: number | null) => void;
  year?: number;
  months?: number[]; // the quarter's months (1–12), e.g. Q3 → [7,8,9]
}) {
  const useMonthly = !!year && !!months && months.length > 0;
  const [items, setItems] = useState<Initiative[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/initiatives?keyResultId=${keyResultId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoaded(true));
    fetch("/api/team-members")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: TeamMember[]) => setTeam(Array.isArray(d) ? d.map((m) => ({ id: m.id, name: m.name })) : []))
      .catch(() => {});
  }, [keyResultId]);

  // Roll this KR's achievement up to the parent whenever initiatives change.
  useEffect(() => {
    if (!loaded || !onAchievement) return;
    if (items.length === 0) { onAchievement(null); return; }
    const avg = items.reduce((s, it) => s + (it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0), 0) / items.length;
    onAchievement(avg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loaded]);

  async function add() {
    const title = text.trim();
    if (!title || busy) return;
    setBusy(true);
    const res = await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyResultId, title, unit: krUnit, target: 1 }),
    });
    setBusy(false);
    if (res.ok) {
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setText("");
    }
  }

  function patchLocal(id: string, data: Partial<Initiative>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
  }
  async function patch(id: string, data: Partial<Initiative>) {
    await fetch(`/api/initiatives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }
  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/initiatives/${id}`, { method: "DELETE" });
  }

  function monthValue(it: Initiative, m: number): number | "" {
    const e = (it.monthly ?? []).find((x) => x.year === year && x.month === m);
    return e ? e.actual : "";
  }
  // Update one month locally; the initiative's actual tracks the latest month.
  function setMonthLocal(id: string, m: number, val: number) {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const monthly = [...(it.monthly ?? [])];
      const idx = monthly.findIndex((x) => x.year === year && x.month === m);
      if (idx >= 0) monthly[idx] = { ...monthly[idx], actual: val };
      else monthly.push({ year: year!, month: m, actual: val });
      const latest = [...monthly].sort((a, b) => a.year - b.year || a.month - b.month).pop();
      return { ...it, monthly, actual: latest ? latest.actual : it.actual };
    }));
  }
  async function saveMonth(id: string, m: number, val: number) {
    await fetch("/api/initiatives/monthly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initiativeId: id, year, month: m, actual: val }),
    });
  }

  if (!loaded) return null;
  if (isLocked && items.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Initiatives</p>

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left font-semibold py-1 pr-2">Initiative (action plan)</th>
                <th className="text-left font-semibold py-1 px-2 w-32">PIC</th>
                <th className="text-right font-semibold py-1 px-1 w-16">Target</th>
                {useMonthly
                  ? months!.map((m) => <th key={m} className="text-right font-semibold py-1 px-1 w-14">{MONTH_NAMES[m - 1]}</th>)
                  : <th className="text-right font-semibold py-1 px-1 w-16">Actual</th>}
                <th className="text-right font-semibold py-1 px-1 w-14">% Ach</th>
                <th className="text-left font-semibold py-1 px-2 w-40">Results & Evaluation</th>
                {!isLocked && <th className="w-6"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const pct = it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0;
                return (
                  <tr key={it.id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-2">
                      <textarea
                        rows={1}
                        value={it.title}
                        disabled={isLocked}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                        onChange={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; patchLocal(it.id, { title: e.target.value }); }}
                        onBlur={(e) => !isLocked && patch(it.id, { title: e.target.value.trim() })}
                        className="w-full bg-transparent resize-none overflow-hidden border-b border-transparent hover:border-slate-200 focus:border-amber-400 focus:outline-none text-slate-700 disabled:cursor-default leading-snug"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        value={it.picId ?? ""}
                        disabled={isLocked}
                        onChange={(e) => { const v = e.target.value || null; patchLocal(it.id, { picId: v }); patch(it.id, { picId: v }); }}
                        className="w-full border border-slate-200 rounded-md px-1.5 py-1 bg-white text-slate-600 focus:outline-none focus:border-amber-400 disabled:cursor-default disabled:bg-slate-50"
                      >
                        <option value="">— Unassigned —</option>
                        {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        {it.pic && !team.some((m) => m.id === it.picId) && <option value={it.picId!}>{it.pic.name}</option>}
                      </select>
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" min={0} value={it.target} disabled={isLocked}
                        onChange={(e) => patchLocal(it.id, { target: Number(e.target.value) })}
                        onBlur={(e) => !isLocked && patch(it.id, { target: Number(e.target.value) || 0 })}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full border border-slate-200 rounded-md px-1 py-1 text-right bg-white focus:outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:cursor-default" />
                    </td>
                    {useMonthly ? (
                      months!.map((m) => (
                        <td key={m} className="py-1.5 px-1">
                          <input type="number" min={0} value={monthValue(it, m)} disabled={isLocked}
                            onChange={(e) => setMonthLocal(it.id, m, Number(e.target.value))}
                            onBlur={(e) => !isLocked && saveMonth(it.id, m, Number(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full border border-slate-200 rounded-md px-1 py-1 text-right bg-white focus:outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:cursor-default" />
                        </td>
                      ))
                    ) : (
                      <td className="py-1.5 px-1">
                        <input type="number" min={0} value={it.actual} disabled={isLocked}
                          onChange={(e) => patchLocal(it.id, { actual: Number(e.target.value) })}
                          onBlur={(e) => !isLocked && patch(it.id, { actual: Number(e.target.value) || 0 })}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full border border-slate-200 rounded-md px-1 py-1 text-right bg-white focus:outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:cursor-default" />
                      </td>
                    )}
                    <td className="py-1.5 px-1 text-right">
                      <span className={`inline-block font-bold px-1.5 py-0.5 rounded ${achClass(pct)}`}>{pct.toFixed(0)}%</span>
                    </td>
                    <td className="py-1.5 px-2">
                      <textarea
                        rows={1}
                        value={it.resultNote ?? ""}
                        disabled={isLocked}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                        onChange={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; patchLocal(it.id, { resultNote: e.target.value }); }}
                        onBlur={(e) => !isLocked && patch(it.id, { resultNote: e.target.value })}
                        placeholder="notes…"
                        className="w-full bg-transparent resize-none overflow-hidden border-b border-transparent hover:border-slate-200 focus:border-amber-400 focus:outline-none text-slate-500 disabled:cursor-default leading-snug"
                      />
                    </td>
                    {!isLocked && (
                      <td className="py-1.5 text-right">
                        <button onClick={() => remove(it.id)} className="text-slate-300 hover:text-red-500 transition"><Trash2 size={12} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLocked && (
        <div className="flex items-center gap-2 mt-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Add an initiative (action plan)…"
            className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400"
          />
          <button onClick={add} disabled={busy || !text.trim()} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 flex-shrink-0">
            <Plus size={12} /> Add
          </button>
        </div>
      )}
    </div>
  );
}
