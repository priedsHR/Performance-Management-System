"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEPARTMENTS,
  LEVELS,
  CATEGORY_LABEL,
  type Category,
} from "@/lib/feedback/library";

interface ManualPair {
  id: string;
  raterId: string;
  raterName: string;
  rateeId: string;
  rateeName: string;
  periodId: string | null;
}

interface Comp {
  id: string;
  code: string;
  name: string;
  category: Category;
  department: string | null;
  active: boolean;
}
interface UserLite {
  id: string;
  name: string;
  email: string;
}
interface Profile {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  position: string | null;
  level: string | null;
  targetLevel: number | null;
  isManager: boolean;
  managerId: string | null;
  managerName: string | null;
  active: boolean;
  competencyIds: string[];
}

const CATS: Category[] = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

const blankForm = {
  name: "",
  email: "",
  password: "",
  role: "MEMBER",
  department: "",
  position: "",
  level: "",
  targetMode: "auto",
  managerId: "",
  active: true,
};

export default function EmployeeManager360() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [comps, setComps] = useState<Comp[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...blankForm });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [manualPairs, setManualPairs] = useState<ManualPair[]>([]);
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [pairMsg, setPairMsg] = useState("");
  const [peerEdit, setPeerEdit] = useState<{ userId: string; name: string } | null>(null);
  const [peerCands, setPeerCands] = useState<{ userId: string; name: string; department: string | null; position: string | null; isDeptDefault: boolean; isPeer: boolean }[]>([]);
  const [peerSel, setPeerSel] = useState<Set<string>>(new Set());
  const [peerSaving, setPeerSaving] = useState(false);
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "dept" | "manager">("name");

  async function openPeers(p: Profile) {
    setPeerEdit({ userId: p.userId, name: p.name });
    setPeerCands([]);
    const r = await fetch(`/api/feedback/peers?userId=${p.userId}`);
    const d = await r.json();
    const list = d.candidates || [];
    setPeerCands(list);
    setPeerSel(new Set(list.filter((c: { isPeer: boolean }) => c.isPeer).map((c: { userId: string }) => c.userId)));
  }
  async function savePeers() {
    if (!peerEdit) return;
    setPeerSaving(true);
    await fetch("/api/feedback/peers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: peerEdit.userId, peerIds: [...peerSel] }),
    });
    setPeerSaving(false);
    setPeerEdit(null);
    setMsg("Peers updated — assignments refresh immediately.");
    await load();
  }

  async function load() {
    const [p, c, u, mp] = await Promise.all([
      fetch("/api/feedback/profiles").then((r) => r.json()),
      fetch("/api/feedback/competencies").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/feedback/manual-peers").then((r) => r.json()),
    ]);
    setProfiles(p);
    setComps(c);
    setUsers(u);
    setManualPairs(mp);
  }

  async function addPair() {
    if (!pairA || !pairB || pairA === pairB) { setPairMsg("Choose two different employees."); return; }
    const res = await fetch("/api/feedback/manual-peers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAId: pairA, userBId: pairB }),
    });
    if (res.ok) { setPairA(""); setPairB(""); setPairMsg(""); await load(); }
    else { const d = await res.json().catch(() => ({})); setPairMsg(d.error || "Failed."); }
  }

  async function removePair(pair: ManualPair) {
    await fetch("/api/feedback/manual-peers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAId: pair.raterId, userBId: pair.rateeId }),
    });
    await load();
  }
  useEffect(() => {
    load();
  }, []);

  const activeComps = useMemo(() => comps.filter((c) => c.active), [comps]);

  function autoIds(dept: string, role: string): string[] {
    const isManager = role === "LEAD" || role === "ADMIN";
    return activeComps
      .filter(
        (c) =>
          c.category === "CORE" ||
          (c.category === "LEADERSHIP" && isManager) ||
          (c.category === "JOB_FAMILY" && c.department && c.department === dept) ||
          (c.category === "TECHNICAL" && c.department == null)
      )
      .map((c) => c.id);
  }

  function startNew() {
    setForm({ ...blankForm });
    setSelected(new Set());
    setEditing("new");
    setMsg("");
  }
  function startEdit(p: Profile) {
    setForm({
      name: p.name,
      email: p.email,
      password: "",
      role: p.role,
      department: p.department || "",
      position: p.position || "",
      level: p.level || "",
      targetMode: p.targetLevel == null ? "none" : String(p.targetLevel),
      managerId: p.managerId || "",
      active: p.active,
    });
    setSelected(new Set(p.competencyIds));
    setEditing(p.id);
    setMsg("");
  }

  function applyAuto() {
    const auto = autoIds(form.department, form.role);
    setSelected((prev) => new Set([...prev, ...auto]));
  }
  function toggleComp(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function save() {
    setMsg("");
    const { targetMode, ...rest } = form;
    const body: Record<string, unknown> = {
      ...rest,
      department: form.department || null,
      managerId: form.managerId || null,
      isManager: form.role === "LEAD" || form.role === "ADMIN",
      competencyIds: [...selected],
    };
    // target: auto = let server derive from level; none = null; number = explicit
    if (targetMode === "none") body.targetLevel = null;
    else if (targetMode !== "auto") body.targetLevel = parseInt(targetMode);
    // (auto: omit targetLevel so the API fills it from the level mapping)
    const res =
      editing === "new"
        ? await fetch("/api/feedback/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/feedback/profiles/${editing}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
    if (res.ok) {
      setEditing(null);
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "Failed to save.");
    }
  }

  async function del(p: Profile) {
    const withUser = confirm(
      `Delete the 360 profile of "${p.name}".\n\nPress OK to ALSO DELETE their login account.\nPress Cancel to delete only the 360 profile (login account stays).`
    );
    await fetch(`/api/feedback/profiles/${p.id}${withUser ? "?withUser=1" : ""}`, { method: "DELETE" });
    await load();
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/feedback/profiles/import", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      setMsg((d.message || "Import complete.") + (d.errors ? ` (${d.errors.length} notes)` : ""));
      if (d.errors) console.warn("Import notes:", d.errors);
      await load();
    } else {
      setMsg(d.error || "Failed to import.");
    }
  }

  return (
    <div className="space-y-4">
      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={startNew} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700">
          + Add employee
        </button>
        <a href="/api/feedback/profiles/import" className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
          ⬇ Download Excel template
        </a>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {importing ? "Importing…" : "⬆ Bulk import"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={doImport} />
      </div>
      {msg && <p className="text-sm text-teal-700">{msg}</p>}

      {/* form */}
      {editing && (
        <div className="bg-white border border-teal-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700">{editing === "new" ? "New employee" : "Edit employee"}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name*">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" />
            </Field>
            <Field label="Email* (for login)">
              <input value={form.email} disabled={editing !== "new"} onChange={(e) => setForm({ ...form, email: e.target.value })} className="inp disabled:bg-slate-50 disabled:text-slate-400" />
            </Field>
            <Field label={editing === "new" ? "Password*" : "Password (leave blank to keep)"}>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="inp" />
            </Field>
            <Field label="Access role">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="inp">
                <option value="MEMBER">Member</option>
                <option value="LEAD">Lead</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            <Field label="Department (= peer group)">
              <input
                list="dept-suggestions"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. HR, Finance, Tech…"
                className="inp"
              />
              <datalist id="dept-suggestions">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field label="Position">
              <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="inp" />
            </Field>
            <Field label="Level">
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="inp">
                <option value="">—</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assessment target">
              <select value={form.targetMode} onChange={(e) => setForm({ ...form, targetMode: e.target.value })} className="inp">
                <option value="auto">Automatic from level</option>
                <option value="none">No target</option>
                <option value="1">Target L1</option>
                <option value="2">Target L2</option>
                <option value="3">Target L3</option>
                <option value="4">Target L4</option>
              </select>
            </Field>
            <Field label="Manager (superordinate)">
              <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })} className="inp">
                <option value="">— none —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {(form.role === "LEAD" || form.role === "ADMIN") && (
            <p className="text-xs text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg">
              Lead/Admin roles automatically get the Leadership competencies.
            </p>
          )}

          {/* competency picker */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Competencies assessed ({selected.size})</p>
              <div className="flex gap-2">
                <button onClick={applyAuto} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100">
                  Apply automatic rule
                </button>
                <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50">
                  Clear
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Automatic: Core (all) + Leadership (if manager) + Job Family by department + AI Fluency.
              Department-specific Technical competencies are ticked manually.
            </p>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {CATS.map((cat) => {
                const list = activeComps.filter(
                  (c) => c.category === cat && (cat === "CORE" || cat === "LEADERSHIP" || !c.department || c.department === form.department || c.department == null)
                );
                if (!list.length) return null;
                return (
                  <div key={cat}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{CATEGORY_LABEL[cat]}</p>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {list.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600 py-0.5">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleComp(c.id)} />
                          <span className="truncate">
                            {c.name}
                            {c.department && <span className="text-[11px] text-slate-400"> · {c.department}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700">
              Save
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* search / filter / sort */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search name / position / email…"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">All departments</option>
          {[...new Set(profiles.map((p) => p.department).filter(Boolean))].sort().map((d) => (
            <option key={d as string} value={d as string}>{d}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "dept" | "manager")} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="name">Sort: Name A-Z</option>
          <option value="dept">Sort: Department</option>
          <option value="manager">Sort: Manager</option>
        </select>
      </div>

      {/* list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {profiles.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">No employees yet. Add them one by one or bulk import.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Name</th>
                <th className="text-left px-3 py-2 font-semibold">Department</th>
                <th className="text-left px-3 py-2 font-semibold">Manager</th>
                <th className="text-center px-3 py-2 font-semibold">Komp.</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {profiles
                .filter((p) => !deptFilter || p.department === deptFilter)
                .filter((p) => {
                  const t = q.trim().toLowerCase();
                  if (!t) return true;
                  return [p.name, p.email, p.position, p.department, p.managerName].some((v) => (v || "").toLowerCase().includes(t));
                })
                .sort((a, b) =>
                  sortBy === "dept"
                    ? (a.department || "").localeCompare(b.department || "") || a.name.localeCompare(b.name)
                    : sortBy === "manager"
                    ? (a.managerName || "").localeCompare(b.managerName || "") || a.name.localeCompare(b.name)
                    : a.name.localeCompare(b.name)
                )
                .map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <p className={`font-medium ${p.active ? "text-slate-700" : "text-slate-300"}`}>
                      {p.name}
                      {p.isManager && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">mgr</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">{p.position || "—"} · {p.level || "—"}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.department || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{p.managerName || "—"}</td>
                  <td className="px-3 py-2 text-center text-slate-500">{p.competencyIds.length}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openPeers(p)} className="px-2 py-1 rounded text-xs text-teal-600 hover:bg-teal-50">
                      Peers
                    </button>
                    <button onClick={() => startEdit(p)} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100">
                      Edit
                    </button>
                    <button onClick={() => del(p)} className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual cross-department peers */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Cross-Department Peers</p>
          <p className="text-xs text-slate-400 mt-0.5">Assign two employees from different departments to rate each other as peers.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Employee A</label>
            <select value={pairA} onChange={(e) => setPairA(e.target.value)} className="inp">
              <option value="">— select —</option>
              {profiles.filter((p) => p.active).map((p) => (
                <option key={p.userId} value={p.userId}>{p.name} ({p.department || "—"})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Employee B</label>
            <select value={pairB} onChange={(e) => setPairB(e.target.value)} className="inp">
              <option value="">— select —</option>
              {profiles.filter((p) => p.active && p.userId !== pairA).map((p) => (
                <option key={p.userId} value={p.userId}>{p.name} ({p.department || "—"})</option>
              ))}
            </select>
          </div>
          <button onClick={addPair} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700">
            Add
          </button>
        </div>
        {pairMsg && <p className="text-xs text-red-500">{pairMsg}</p>}
        {manualPairs.length > 0 && (
          <table className="w-full text-sm mt-2">
            <thead className="bg-slate-50 text-slate-400 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Employee A</th>
                <th className="text-left px-3 py-2 font-semibold">Employee B</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {manualPairs.map((pair) => (
                <tr key={pair.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{pair.raterName}</td>
                  <td className="px-3 py-2 text-slate-700">{pair.rateeName}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removePair(pair)} className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {manualPairs.length === 0 && (
          <p className="text-xs text-slate-400">No cross-department peer pairs yet.</p>
        )}
      </div>

      {peerEdit && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setPeerEdit(null); }}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-auto p-5 shadow-2xl">
            <p className="font-bold text-slate-800 mb-1">Peers — {peerEdit.name}</p>
            <p className="text-xs text-slate-400 mb-3">
              Tick everyone who should rate {peerEdit.name.split(" ")[0]} as a <b>peer</b> (mutual). Untick same-department
              colleagues who don't actually work together; tick people from other departments who do.
            </p>
            {peerCands.length === 0 ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[50vh] overflow-auto">
                {peerCands.map((c) => (
                  <label key={c.userId} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={peerSel.has(c.userId)}
                      onChange={() => setPeerSel((prev) => { const n = new Set(prev); if (n.has(c.userId)) n.delete(c.userId); else n.add(c.userId); return n; })}
                    />
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="text-[11px] text-slate-400">{c.department || "—"} · {c.position || "—"}</span>
                    {c.isDeptDefault && <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-teal-600">same dept</span>}
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPeerEdit(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={savePeers} disabled={peerSaving || peerCands.length === 0} className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">{peerSaving ? "Saving…" : "Save peers"}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
