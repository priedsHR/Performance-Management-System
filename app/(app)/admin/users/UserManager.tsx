"use client";

import { useState, useRef } from "react";
import { Trash2, Edit2 } from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  division: string | null;
  createdAt: string;
};
type TeamMemberOption = {
  id: string;
  name: string;
  leadId: string;
  userId: string | null;
  lead: { division: string | null };
};

type FormState = {
  name: string;
  email: string;
  password: string;
  role: string;
  division: string;
  teamMemberId: string;
};

const emptyForm: FormState = { name: "", email: "", password: "", role: "MEMBER", division: "", teamMemberId: "" };

const ROLE_LABELS: Record<string, string> = { ADMIN: "Admin", LEAD: "Division Lead", MEMBER: "Member" };
const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  LEAD: "bg-amber-100 text-amber-700",
  MEMBER: "bg-slate-100 text-slate-600",
};
const ROLE_EMOJI: Record<string, string> = { ADMIN: "🛡️", LEAD: "⭐", MEMBER: "👤" };

const btnPrimary =
  "flex items-center gap-2 bg-amber-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl " +
  "shadow-[0_4px_0_#097eb9] hover:shadow-[0_2px_0_#097eb9] hover:translate-y-0.5 " +
  "active:shadow-[0_1px_0_#097eb9] active:translate-y-[3px] transition-all duration-75";

const btnSecondary =
  "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-xl " +
  "shadow-[0_4px_0_#e2e8f0] hover:shadow-[0_2px_0_#e2e8f0] hover:translate-y-0.5 " +
  "active:shadow-[0_1px_0_#e2e8f0] active:translate-y-[3px] transition-all duration-75";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white transition";

function UserForm({ form, isEdit, onChange, onSave, onCancel, teamMembers, editUserId }: {
  form: FormState;
  isEdit: boolean;
  onChange: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  teamMembers: TeamMemberOption[];
  editUserId?: string;
}) {
  // Available team members: unlinked, OR linked to this user being edited
  const availableTeamMembers = teamMembers.filter(
    (tm) => tm.userId === null || tm.userId === editUserId
  );

  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-6 mb-5">
      <h2 className="font-semibold text-slate-800 mb-4">
        {isEdit ? "✏️ Edit User" : "➕ New User"}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">👤 Name</label>
          <input className={inputCls} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} placeholder="Full name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">📧 Email</label>
          <input type="email" className={inputCls} value={form.email} onChange={(e) => onChange({ ...form, email: e.target.value })} placeholder="email@perusahaan.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            🔒 Password{" "}
            {isEdit && <span className="text-slate-400 font-normal">(leave blank to keep)</span>}
          </label>
          <input type="password" className={inputCls} value={form.password} onChange={(e) => onChange({ ...form, password: e.target.value })} placeholder="••••••••" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">🎭 Role</label>
          <select className={inputCls} value={form.role} onChange={(e) => onChange({ ...form, role: e.target.value, teamMemberId: "" })}>
            <option value="MEMBER">👤 Member (anggota division)</option>
            <option value="LEAD">⭐ Division Lead</option>
            <option value="ADMIN">🛡️ Admin (HR)</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            🏢 Division
            {form.role === "LEAD" && (
              <span className="text-amber-600 ml-1 font-normal">— Leads & Members with the same division name are grouped</span>
            )}
          </label>
          <input className={inputCls} value={form.division} onChange={(e) => onChange({ ...form, division: e.target.value })} placeholder="e.g. Designer Brand, Content Creator, Visual Designer" />
        </div>
        {form.role === "MEMBER" && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              🔗 Link ke Member Tim
              <span className="text-slate-400 font-normal ml-1">— hubungkan ke data distribusi OKR dari Lead</span>
            </label>
            <select
              className={inputCls}
              value={form.teamMemberId}
              onChange={(e) => onChange({ ...form, teamMemberId: e.target.value })}
            >
              <option value="">— Not linked —</option>
              {availableTeamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name} ({tm.lead.division ?? "No Division"})
                </option>
              ))}
            </select>
            {availableTeamMembers.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">No team members to link yet. Add them first on the Member Distribution page.</p>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onSave} className={btnPrimary}>💾 Save</button>
        <button onClick={onCancel} className={btnSecondary}>✕ Cancel</button>
      </div>
    </div>
  );
}

export default function UserManager({ initialUsers, teamMembers }: { initialUsers: User[]; teamMembers: TeamMemberOption[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [tms, setTms] = useState<TeamMemberOption[]>(teamMembers);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ type: "success" | "error"; message: string; errors?: string[]; linkLog?: string[] } | null>(null);
  const [linkingUserId, setLinkingUserId] = useState<string | null>(null);
  const [linkSelectValue, setLinkSelectValue] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function cancel() { setShowForm(false); setEditId(null); setForm(emptyForm); }

  async function saveLink(userId: string) {
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId: linkSelectValue }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Failed to save link: " + (err.error ?? JSON.stringify(err)));
        return;
      }
      setTms((prev) => prev.map((tm) => {
        if (tm.userId === userId) return { ...tm, userId: null };
        if (tm.id === linkSelectValue) return { ...tm, userId };
        return tm;
      }));
      setLinkingUserId(null);
      setLinkSelectValue("");
    } catch {
      alert("A network error occurred.");
    } finally {
      setLinkSaving(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/users/import", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult({ type: "success", message: data.message, errors: data.errors, linkLog: data.linkLog });
        const reloaded = await fetch("/api/users").then((r) => r.json());
        setUsers(Array.isArray(reloaded) ? reloaded : []);
        // Reload tms to reflect new links
        const reloadedTms = await fetch("/api/admin/team-members").then((r) => r.json()).catch(() => null);
        if (Array.isArray(reloadedTms)) setTms(reloadedTms);
      } else {
        setImportResult({ type: "error", message: data.error ?? "Import failed.", errors: data.errors, linkLog: data.linkLog });
      }
    } catch {
      setImportResult({ type: "error", message: "A network error occurred." });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function createUser() {
    if (!form.name || !form.email || !form.password) { alert("Name, email, and password are required."); return; }
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { alert((await res.json()).error ?? "Failed to create user"); return; }
    const user = await res.json();
    setUsers((prev) => [...prev, user].sort((a, b) => a.name.localeCompare(b.name)));
    if (form.teamMemberId) {
      setTms((prev) => prev.map((tm) => tm.id === form.teamMemberId ? { ...tm, userId: user.id } : tm));
    }
    cancel();
  }

  async function updateUser() {
    if (!editId) return;
    const payload: Partial<FormState & { teamMemberId: string }> = {
      name: form.name, email: form.email, role: form.role, division: form.division, teamMemberId: form.teamMemberId,
    };
    if (form.password) payload.password = form.password;
    const res = await fetch(`/api/users/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const updated = await res.json();
    setUsers((prev) => prev.map((u) => (u.id === editId ? updated : u)));
    // Update local teamMembers state: clear old link, set new link
    setTms((prev) => prev.map((tm) => {
      if (tm.userId === editId) return { ...tm, userId: null };
      if (tm.id === form.teamMemberId) return { ...tm, userId: editId };
      return tm;
    }));
    cancel();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? All of their OKRs will be deleted.")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  function startEdit(user: User) {
    setEditId(user.id);
    setShowForm(false);
    const linkedTm = tms.find((tm) => tm.userId === user.id);
    setForm({ name: user.name, email: user.email, password: "", role: user.role, division: user.division ?? "", teamMemberId: linkedTm?.id ?? "" });
  }

  const grouped = users.reduce<Record<string, User[]>>((acc, u) => {
    const key = u.division || "(No Division)";
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setShowForm((v) => !v); setEditId(null); setForm(emptyForm); }}
            className={btnPrimary}
          >
            ➕ Add User
          </button>
          <a href="/api/users/import" className={btnSecondary}>📋 Download Template</a>
          <label className={`${btnSecondary} cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            {importing ? "⏳ Importing..." : "📤 Bulk Import Excel"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
        </div>
        <p className="text-xs text-slate-400">Download the template → fill it in → upload to create accounts in bulk</p>
      </div>

      {importResult && (
        <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${importResult.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          <p className="font-semibold">{importResult.type === "success" ? "✅" : "❌"} {importResult.message}</p>
          {importResult.errors?.map((e, i) => <p key={i} className="text-xs mt-0.5">{e}</p>)}
          {importResult.linkLog && importResult.linkLog.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs font-semibold cursor-pointer opacity-70">🔗 Detail auto-link ({importResult.linkLog.length})</summary>
              {importResult.linkLog.map((l, i) => <p key={i} className="text-xs mt-0.5 font-mono">{l}</p>)}
            </details>
          )}
        </div>
      )}

      {showForm && <UserForm form={form} isEdit={false} onChange={setForm} onSave={createUser} onCancel={cancel} teamMembers={tms} />}
      {editId && <UserForm form={form} isEdit={true} onChange={setForm} onSave={updateUser} onCancel={cancel} teamMembers={tms} editUserId={editId} />}

      <div className="space-y-4">
        {Object.entries(grouped).map(([division, divUsers]) => (
          <div key={division} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span className="font-semibold text-slate-700 text-sm">{division}</span>
              <span className="text-slate-400 text-xs">({divUsers.length} orang)</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {divUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 font-medium text-slate-800">{user.name}</td>
                    <td className="px-5 py-3 text-slate-500">{user.email}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-600"}`}>
                          {ROLE_EMOJI[user.role]} {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                        {user.role === "MEMBER" && (() => {
                          const linked = tms.find((tm) => tm.userId === user.id);
                          return linked
                            ? <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">🔗 {linked.name}</span>
                            : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">⚠️ Not yet di-link</span>;
                        })()}
                      </div>
                      {/* Inline link UI */}
                      {user.role === "MEMBER" && linkingUserId === user.id && (
                        <div className="flex items-center gap-2 mt-2">
                          <select
                            value={linkSelectValue}
                            onChange={(e) => setLinkSelectValue(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            <option value="">— Not linked —</option>
                            {tms.filter((tm) => tm.userId === null || tm.userId === user.id).map((tm) => (
                              <option key={tm.id} value={tm.id}>{tm.name} ({tm.lead.division ?? "—"})</option>
                            ))}
                          </select>
                          <button
                            onClick={() => saveLink(user.id)}
                            disabled={linkSaving}
                            className="text-xs font-semibold px-3 py-1 bg-amber-400 text-white rounded-lg shadow-[0_2px_0_#097eb9] hover:shadow-[0_1px_0_#097eb9] hover:translate-y-px transition-all disabled:opacity-50"
                          >
                            {linkSaving ? "⏳" : "💾 Save"}
                          </button>
                          <button onClick={() => { setLinkingUserId(null); setLinkSelectValue(""); }} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.role === "MEMBER" && (
                          <button
                            onClick={() => {
                              const linked = tms.find((tm) => tm.userId === user.id);
                              setLinkingUserId(linkingUserId === user.id ? null : user.id);
                              setLinkSelectValue(linked?.id ?? "");
                            }}
                            className="text-xs font-semibold text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 border border-blue-200 transition"
                            title="Link to a team member"
                          >
                            🔗
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(user)}
                          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100
                            shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px
                            active:shadow-none active:translate-y-[2px] transition-all duration-75"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50
                            shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#fecaca] hover:translate-y-px
                            active:shadow-none active:translate-y-[2px] transition-all duration-75"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {users.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-slate-500 text-sm">No users. Click "Add User" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
