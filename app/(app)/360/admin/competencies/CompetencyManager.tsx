"use client";

import { useEffect, useState } from "react";
import { Trash2, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { DEPARTMENTS, CATEGORY_LABEL, type Category } from "@/lib/feedback/library";

interface Comp {
  id: string;
  code: string;
  name: string;
  category: Category;
  department: string | null;
  definition: string | null;
  l1: string | null;
  l2: string | null;
  l3: string | null;
  l4: string | null;
  active: boolean;
}

const CATS: Category[] = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

const empty = { name: "", category: "CORE" as Category, department: "", definition: "", l1: "", l2: "", l3: "", l4: "" };

const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white transition";
const btnPrimary = "flex items-center gap-2 bg-[#0b8ec4] text-white hover:bg-[#097eb9] font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm hover:shadow-sm active:shadow-sm disabled:opacity-50 transition-all duration-75";
const btnSecondary = "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm hover:shadow-sm active:shadow-sm transition-all duration-75";

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 animate-pulse">
      <div className="space-y-1.5 flex-1">
        <div className="h-3.5 bg-slate-200 rounded w-1/3" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-12 bg-slate-100 rounded-lg" />
        <div className="h-7 w-20 bg-slate-100 rounded-lg" />
        <div className="h-7 w-12 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {CATS.map((cat) => (
        <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-32" />
          </div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ))}
    </div>
  );
}

export default function CompetencyManager() {
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  // Bulk mode
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState<Category>("CORE");
  const [bulkDept, setBulkDept] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  async function load() {
    const r = await fetch("/api/feedback/competencies");
    setComps(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm({ ...empty }); setEditing("new"); setBulkOpen(false); }
  function startEdit(c: Comp) {
    setForm({ name: c.name, category: c.category, department: c.department || "", definition: c.definition || "", l1: c.l1 || "", l2: c.l2 || "", l3: c.l3 || "", l4: c.l4 || "" });
    setEditing(c.id);
    setBulkOpen(false);
  }

  async function save() {
    if (!form.name.trim()) { alert("Name is required."); return; }
    setSaving(true);
    const body = { ...form, department: form.department || null };
    if (editing === "new") {
      await fetch("/api/feedback/competencies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch(`/api/feedback/competencies/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setSaving(false);
    setEditing(null);
    await load();
  }

  async function toggle(c: Comp) {
    await fetch(`/api/feedback/competencies/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
    await load();
  }

  async function del(c: Comp) {
    if (!confirm(`Delete competency "${c.name}"? This also removes it from related profiles & assessments.`)) return;
    await fetch(`/api/feedback/competencies/${c.id}`, { method: "DELETE" });
    await load();
  }

  async function saveBulk() {
    const names = bulkText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!names.length) { setBulkMsg("Enter at least one competency name."); return; }
    setBulkSaving(true);
    setBulkMsg("");
    const res = await fetch("/api/feedback/competencies/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names, category: bulkCategory, department: bulkDept || null }),
    });
    const data = await res.json();
    setBulkSaving(false);
    if (res.ok) {
      setBulkMsg(`${data.created} competencies created.${data.errors?.length ? ` ${data.errors.length} failed.` : ""}`);
      setBulkText("");
      await load();
    } else {
      setBulkMsg(`${data.error ?? "Failed."}`);
    }
  }

  const needsDept = form.category === "JOB_FAMILY" || form.category === "TECHNICAL";
  const bulkNeedsDept = bulkCategory === "JOB_FAMILY" || bulkCategory === "TECHNICAL";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <button onClick={startNew} className={btnPrimary}>Add Competency</button>
        <button onClick={() => { setBulkOpen((v) => !v); setEditing(null); setBulkMsg(""); }} className={btnSecondary}>
          Bulk Add
        </button>
      </div>

      {/* Bulk add form */}
      {bulkOpen && (
        <div className="bg-white border border-amber-200 rounded-2xl p-6 space-y-4">
          <p className="font-semibold text-slate-800">Bulk Add Competencies</p>
          <p className="text-xs text-slate-400">Write one name per line. All competencies will be created with the same category & department.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Category*</label>
              <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value as Category)} className={inp}>
                {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            {bulkNeedsDept && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Department (blank = all)</label>
                <select value={bulkDept} onChange={(e) => setBulkDept(e.target.value)} className={inp}>
                  <option value="">All departments</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Competency Names (one per line)*</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Effective Communication\nTeam Collaboration\nProblem Solving"}
              rows={6}
              className={inp}
            />
            <p className="text-xs text-slate-400 mt-1">{bulkText.split("\n").filter((s) => s.trim()).length} competencies ready to create</p>
          </div>
          {bulkMsg && (
            <p className={`text-sm px-3 py-2 rounded-xl border ${bulkMsg.includes("created") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
              {bulkMsg}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={saveBulk} disabled={bulkSaving} className={btnPrimary}>
              {bulkSaving ? "Saving..." : "Save All"}
            </button>
            <button onClick={() => { setBulkOpen(false); setBulkMsg(""); }} className={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Single add/edit form */}
      {editing && (
        <div className="bg-white border border-amber-200 rounded-2xl p-6 space-y-4">
          <p className="font-semibold text-slate-800">{editing === "new" ? "New Competency" : "Edit Competency"}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Name*</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="Competency name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Category*</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })} className={inp}>
                {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            {needsDept && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Department (blank = all)</label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inp}>
                  <option value="">All departments</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Definition</label>
            <textarea value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} className={inp} rows={2} placeholder="Short description of this competency" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {([1, 2, 3, 4] as const).map((n) => (
              <div key={n}>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Anchor Level {n}</label>
                <input value={(form as Record<string, string>)[`l${n}`]} onChange={(e) => setForm({ ...form, [`l${n}`]: e.target.value })} className={inp} placeholder={`Behavior description for level ${n}`} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setEditing(null)} className={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Competency list */}
      {!loading && (
        <>
          {CATS.map((cat) => {
            const list = comps.filter((c) => c.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-600">{CATEGORY_LABEL[cat]}</span>
                  <span className="text-slate-400 text-xs">({list.filter((c) => c.active).length} active / {list.length} total)</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {list.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/50 transition">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${c.active ? "text-slate-800" : "text-slate-300 line-through"}`}>
                          {c.name}
                          {c.department && <span className="ml-2 text-[11px] text-slate-400">· {c.department}</span>}
                        </p>
                        {c.definition && <p className="text-[11px] text-slate-400 truncate mt-0.5">{c.definition}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(c)}
                          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 shadow-sm hover:shadow-sm transition-all duration-75">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => toggle(c)}
                          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 shadow-sm hover:shadow-sm transition-all duration-75"
                          title={c.active ? "Deactivate" : "Activate"}>
                          {c.active ? <ToggleRight size={15} className="text-green-500" /> : <ToggleLeft size={15} className="text-slate-400" />}
                        </button>
                        <button onClick={() => del(c)}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 shadow-sm hover:shadow-sm transition-all duration-75">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {comps.length === 0 && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3"></div>
              <p className="text-slate-500 text-sm">No competencies yet. Add them one by one or use Bulk Add.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
