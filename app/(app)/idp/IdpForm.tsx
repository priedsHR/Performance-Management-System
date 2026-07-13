"use client";

import { useEffect, useState } from "react";

interface Plan {
  status: string;
  leadNote: string;
  [k: string]: string;
}

const EMPTY: Record<string, string> = {
  careerAspiration: "", coreStrength: "",
  technicalFocus: "", technicalAction: "", technicalMetric: "",
  behavioralFocus: "", behavioralAction: "", behavioralMetric: "",
  learningFocus: "", learningAction: "", learningMetric: "",
  impactProject: "",
};

const ROWS = [
  { key: "technical", goal: "Technical", hint: "What specific hard skill is needed for your next OKR?", pct: "70%", example: "e.g. 70%: Own the [Project] API docs." },
  { key: "behavioral", goal: "Behavioral", hint: "Based on 360 feedback, what soft skill needs work?", pct: "20%", example: "e.g. 20%: Weekly feedback sync with Lead." },
  { key: "learning", goal: "Learning", hint: "What knowledge gap exists?", pct: "10%", example: "e.g. 10%: Certification in [Skill]." },
];

const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white";

export default function IdpForm({ isLead = false }: { isLead?: boolean }) {
  const [period, setPeriod] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [status, setStatus] = useState("DRAFT");
  const [leadNote, setLeadNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/idp")
      .then((r) => r.json())
      .then((d) => {
        setPeriod(d.period);
        if (d.plan) {
          const f = { ...EMPTY };
          for (const k of Object.keys(EMPTY)) f[k] = d.plan[k] ?? "";
          setForm(f);
          setStatus(d.plan.status);
          setLeadNote(d.plan.leadNote || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(submit: boolean) {
    setSaving(submit ? "submit" : "draft");
    setMsg("");
    const res = await fetch("/api/idp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: period?.id, ...form, submit }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(null);
    if (res.ok) {
      setStatus(d.plan.status);
      setMsg(submit ? "IDP submitted ✓ — discuss it with your lead in the next 1-on-1." : "Draft saved");
    } else setMsg(d.error || "Failed to save.");
  }

  if (loading) return <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse h-40" />;
  if (!period)
    return <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">No semester period exists yet. Ask the admin to create one in 360 → Periods.</div>;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-bold text-slate-800">My IDP — {period.name} <span className="text-slate-400 font-normal">(6 months)</span></p>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status === "SUBMITTED" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
          {status === "SUBMITTED" ? "Submitted" : "Draft"}
        </span>
      </div>

      {/* Section 1 */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700 mb-2">Section 1 · The "Why"</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Career Aspiration — where do you see yourself in 2 years at PRIEDS?</label>
            <textarea rows={3} value={form.careerAspiration} onChange={set("careerAspiration")} className={inp} placeholder="e.g. Lead Designer, Product Manager…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Core Strength — what do you do better than anyone on the team?</label>
            <textarea rows={3} value={form.coreStrength} onChange={set("coreStrength")} className={inp} placeholder="e.g. Visual storytelling…" />
          </div>
        </div>
      </div>

      {/* Section 2 */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700 mb-1">Section 2 · Development Action Plan (70-20-10)</p>
        <p className="text-[11px] text-slate-400 mb-2">{isLead ? "Leads focus on self-growth: behavioral & learning goals only — no technical row, to keep the load sustainable." : "Based on my 360 feedback, I need to improve [behavior/skill] to hit my next OKR."}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-slate-400 text-xs text-left">
                <th className="py-1.5 pr-2 font-semibold w-24">IDP Goal</th>
                <th className="py-1.5 px-1 font-semibold">Focus Area</th>
                <th className="py-1.5 px-1 font-semibold">Action ({"70-20-10"})</th>
                <th className="py-1.5 pl-1 font-semibold">Success Metric</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.filter((r) => !isLead || r.key !== "technical").map((r) => (
                <tr key={r.key} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    <p className="font-semibold text-slate-700">{r.goal}</p>
                    <p className="text-[10px] text-slate-400">{r.pct}</p>
                  </td>
                  <td className="py-2 px-1"><textarea rows={2} value={form[`${r.key}Focus`]} onChange={set(`${r.key}Focus`)} className={inp} placeholder={r.hint} /></td>
                  <td className="py-2 px-1"><textarea rows={2} value={form[`${r.key}Action`]} onChange={set(`${r.key}Action`)} className={inp} placeholder={r.example} /></td>
                  <td className="py-2 pl-1"><textarea rows={2} value={form[`${r.key}Metric`]} onChange={set(`${r.key}Metric`)} className={inp} placeholder="KPI or deliverable" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3 */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-teal-700 mb-1.5">Impact Project — how will your growth help PRIEDS this year?</label>
        <textarea rows={3} value={form.impactProject} onChange={set("impactProject")} className={inp}
          placeholder='e.g. "By learning Auto-Layout in Figma, I will speed up our UI delivery by 20%."' />
      </div>

      {leadNote && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
          <p className="text-xs font-bold text-teal-700 mb-1">Coaching note from your lead</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{leadNote}</p>
        </div>
      )}

      {msg && <p className="text-sm text-teal-700">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={() => save(false)} disabled={saving !== null} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {saving === "draft" ? "Saving…" : "Save draft"}
        </button>
        <button onClick={() => save(true)} disabled={saving !== null} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
          {saving === "submit" ? "Submitting…" : "Submit IDP"}
        </button>
      </div>
    </div>
  );
}
