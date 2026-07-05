"use client";

import { useEffect, useState } from "react";

interface PlanRow {
  id: string;
  userId: string;
  periodId: string;
  userName: string;
  position: string | null;
  division: string | null;
  status: string;
  leadNote: string;
  careerAspiration: string;
  coreStrength: string;
  technicalFocus: string; technicalAction: string; technicalMetric: string;
  behavioralFocus: string; behavioralAction: string; behavioralMetric: string;
  learningFocus: string; learningAction: string; learningMetric: string;
  impactProject: string;
}

export default function IdpList() {
  const [period, setPeriod] = useState<{ id: string; name: string } | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/idp?list=1")
      .then((r) => r.json())
      .then((d) => {
        setPeriod(d.period);
        setPlans(d.plans || []);
        const n: Record<string, string> = {};
        (d.plans || []).forEach((p: PlanRow) => (n[p.id] = p.leadNote || ""));
        setNotes(n);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveNote(p: PlanRow) {
    setSavingNote(p.id);
    await fetch("/api/idp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: p.userId, periodId: p.periodId, leadNote: notes[p.id] || "" }),
    });
    setSavingNote(null);
  }

  if (loading) return <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-24" />;
  if (!plans.length)
    return <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-400">No IDPs {period ? `for ${period.name}` : ""} yet.</div>;

  return (
    <div className="space-y-2">
      {plans.map((p) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <button onClick={() => setOpenId(open ? null : p.id)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{p.userName}</p>
                <p className="text-[11px] text-slate-400">{p.position || "—"} · {p.division || "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                  {p.status === "SUBMITTED" ? "✓ Submitted" : "Draft"}
                </span>
                <span className="text-slate-300">{open ? "▲" : "▼"}</span>
              </div>
            </button>
            {open && (
              <div className="px-5 pb-5 border-t border-slate-100 text-sm space-y-3 pt-3">
                <Item label="Career Aspiration" text={p.careerAspiration} />
                <Item label="Core Strength" text={p.coreStrength} />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead><tr className="text-slate-400 text-left"><th className="py-1 pr-2 font-semibold">Goal</th><th className="py-1 px-1 font-semibold">Focus</th><th className="py-1 px-1 font-semibold">Action</th><th className="py-1 pl-1 font-semibold">Metric</th></tr></thead>
                    <tbody>
                      {(["technical", "behavioral", "learning"] as const).map((k) => (
                        <tr key={k} className="border-t border-slate-100 align-top">
                          <td className="py-1.5 pr-2 font-semibold text-slate-700 capitalize">{k}</td>
                          <td className="py-1.5 px-1 text-slate-600">{p[`${k}Focus`] || "—"}</td>
                          <td className="py-1.5 px-1 text-slate-600">{p[`${k}Action`] || "—"}</td>
                          <td className="py-1.5 pl-1 text-slate-600">{p[`${k}Metric`] || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Item label="Impact Project" text={p.impactProject} />
                <div>
                  <p className="text-[11px] font-bold text-teal-700 mb-1">💬 Coaching note (visible to the employee)</p>
                  <textarea rows={2} value={notes[p.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Agreements from the 1-on-1, support needed, timeline…" />
                  <button onClick={() => saveNote(p)} disabled={savingNote === p.id} className="mt-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                    {savingNote === p.id ? "Saving…" : "Save note"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Item({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-700 whitespace-pre-wrap">{text || "—"}</p>
    </div>
  );
}
