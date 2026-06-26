"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SCALE, CATEGORY_LABEL, type Category } from "@/lib/feedback/library";

interface Comp {
  id: string;
  code: string;
  name: string;
  category: Category;
  definition: string | null;
  levels: (string | null)[];
  score: number | null;
}
interface Task {
  rateeUserId: string;
  rateeName: string;
  position: string | null;
  department: string | null;
  targetLevel: number | null;
  relation: string;
  competencies: Comp[];
  comments: Record<string, string>;
  answered: number;
  total: number;
  submitted: boolean;
}

const CAT_ORDER: Category[] = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

// Stored `relation` = rater's group relative to ratee. Shown to the rater as
// how the RATEE relates to them.
const rateeLabel: Record<string, string> = {
  SELF: "Diri sendiri",
  SUBORDINATE: "Atasan",
  SUPERORDINATE: "Bawahan",
  PEER: "Rekan (peer)",
};
const relTag: Record<string, string> = {
  SELF: "bg-indigo-50 text-indigo-600",
  PEER: "bg-emerald-50 text-emerald-600",
  SUBORDINATE: "bg-amber-50 text-amber-600",
  SUPERORDINATE: "bg-violet-50 text-violet-600",
};

export default function MyAssessment() {
  const [period, setPeriod] = useState<{ id: string; name: string } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [comments, setComments] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openInd, setOpenInd] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/feedback/my-assessment");
    const data = await res.json();
    setPeriod(data.period);
    setTasks(data.tasks || []);
    const initS: Record<string, Record<string, number>> = {};
    const initC: Record<string, Record<string, string>> = {};
    (data.tasks || []).forEach((t: Task) => {
      initS[t.rateeUserId] = {};
      t.competencies.forEach((c) => {
        if (c.score != null) initS[t.rateeUserId][c.id] = c.score;
      });
      initC[t.rateeUserId] = { ...(t.comments || {}) };
    });
    setScores(initS);
    setComments(initC);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function setScore(ratee: string, comp: string, v: number) {
    setScores((s) => ({ ...s, [ratee]: { ...(s[ratee] || {}), [comp]: v } }));
  }
  function setComment(ratee: string, cat: string, v: string) {
    setComments((s) => ({ ...s, [ratee]: { ...(s[ratee] || {}), [cat]: v } }));
  }
  function toggleInd(id: string) {
    setOpenInd((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function save(ratee: string, submit: boolean) {
    setSaving(ratee);
    setMsg("");
    const res = await fetch("/api/feedback/my-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateeUserId: ratee, scores: scores[ratee] || {}, comments: comments[ratee] || {}, submit }),
    });
    setSaving(null);
    if (res.ok) {
      setMsg(submit ? "Penilaian dikumpulkan ✓" : "Tersimpan sebagai draf ✓");
      await load();
      if (submit) setOpenId(null);
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "Gagal menyimpan.");
    }
  }

  if (loading) return <div className="text-sm text-slate-400">Memuat…</div>;

  if (!period)
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 text-sm">
        Belum ada periode 360 yang aktif. Tunggu admin mengaktifkan periode penilaian.
      </div>
    );

  if (tasks.length === 0)
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-500 text-sm">
        Tidak ada kolega yang perlu kamu nilai pada periode <b>{period.name}</b>. Jika ini keliru,
        hubungi admin untuk memeriksa profil 360-mu (departemen & atasan).
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">Periode: {period.name}</span>
        <Link href="/360/report" className="text-sm text-teal-700 hover:underline">Lihat rapor saya →</Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">Skala penilaian (1–4)</p>
        <div className="grid sm:grid-cols-4 gap-2">
          {SCALE.map((s) => (
            <div key={s.value} className="border border-slate-100 rounded-lg p-2 border-l-2 border-l-teal-400">
              <p className="text-xs font-bold text-teal-700">{s.value} — {s.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{s.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="text-sm text-teal-700">{msg}</div>}

      {tasks.map((t) => {
        const open = openId === t.rateeUserId;
        const answered = Object.keys(scores[t.rateeUserId] || {}).length;
        const cats = CAT_ORDER.filter((cat) => t.competencies.some((c) => c.category === cat));
        return (
          <div key={t.rateeUserId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <button onClick={() => setOpenId(open ? null : t.rateeUserId)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${relTag[t.relation] || "bg-slate-100 text-slate-500"}`}>{rateeLabel[t.relation]}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{t.rateeName}</p>
                  <p className="text-xs text-slate-400 truncate">{t.position || "—"}{t.targetLevel ? ` · target L${t.targetLevel}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {t.submitted ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">✓ Terkumpul</span>
                ) : (
                  <span className="text-[11px] text-slate-400">{answered}/{t.total} terisi</span>
                )}
                <span className="text-slate-300">{open ? "▲" : "▼"}</span>
              </div>
            </button>

            {open && (
              <div className="px-5 pb-5 border-t border-slate-100">
                {cats.map((cat) => (
                  <div key={cat} className="mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700 mb-2">{CATEGORY_LABEL[cat]}</p>
                    <div className="space-y-2">
                      {t.competencies.filter((c) => c.category === cat).map((c) => {
                        const cur = scores[t.rateeUserId]?.[c.id];
                        const indOpen = openInd.has(c.id);
                        return (
                          <div key={c.id} className="py-1.5 border-b border-dashed border-slate-100 last:border-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700">{c.name}</p>
                                {c.definition && <p className="text-[11px] text-slate-400">{c.definition}</p>}
                                <button onClick={() => toggleInd(c.id)} className="text-[11px] text-teal-600 hover:underline mt-0.5">
                                  {indOpen ? "Sembunyikan indikator level ▲" : "Lihat indikator level ▼"}
                                </button>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {[1, 2, 3, 4].map((v) => (
                                  <button key={v} onClick={() => setScore(t.rateeUserId, c.id, v)} className={`w-8 h-8 rounded-lg text-sm font-semibold border transition-colors ${cur === v ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-500 border-slate-200 hover:border-teal-300"}`}>{v}</button>
                                ))}
                              </div>
                            </div>
                            {indOpen && (
                              <div className="mt-2 grid sm:grid-cols-2 gap-1.5 bg-slate-50 rounded-lg p-3">
                                {[1, 2, 3, 4].map((lv) => (
                                  <div key={lv} className={`text-[11px] ${cur === lv ? "text-teal-700 font-semibold" : "text-slate-500"}`}>
                                    <span className="inline-block w-9 font-bold">L{lv}</span>
                                    {c.levels[lv - 1] || "—"}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2">
                      <label className="block text-[11px] text-slate-400 mb-1">Catatan / bukti untuk {CATEGORY_LABEL[cat]} (opsional)</label>
                      <textarea
                        value={comments[t.rateeUserId]?.[cat] || ""}
                        onChange={(e) => setComment(t.rateeUserId, cat, e.target.value)}
                        rows={2}
                        placeholder="Contoh perilaku nyata yang mendasari penilaian di kategori ini…"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 mt-5">
                  <button onClick={() => save(t.rateeUserId, false)} disabled={saving === t.rateeUserId} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">Simpan draf</button>
                  <button onClick={() => save(t.rateeUserId, true)} disabled={saving === t.rateeUserId} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">{saving === t.rateeUserId ? "Menyimpan…" : "Kumpulkan penilaian"}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
