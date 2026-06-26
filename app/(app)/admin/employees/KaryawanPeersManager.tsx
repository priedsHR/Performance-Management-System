"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { DEPARTMENTS, LEVELS, CATEGORY_LABEL, type Category } from "@/lib/feedback/library";

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
interface Comp { id: string; code: string; name: string; category: Category; department: string | null; active: boolean }
interface UserLite { id: string; name: string; email: string }
interface ManualPair { id: string; raterId: string; raterName: string; rateeId: string; rateeName: string; periodId: string | null; isPeer: boolean }

const CATS: Category[] = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

const blankForm = { name: "", email: "", password: "", role: "MEMBER", department: "", position: "", level: "", targetMode: "auto", managerId: "", active: true };

const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white transition";
const btnPrimary = "flex items-center gap-2 bg-amber-400 text-gray-900 font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0_#d97706] hover:shadow-[0_2px_0_#d97706] hover:translate-y-0.5 active:shadow-[0_1px_0_#d97706] active:translate-y-[3px] transition-all duration-75";
const btnSecondary = "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0_#e2e8f0] hover:shadow-[0_2px_0_#e2e8f0] hover:translate-y-0.5 active:shadow-[0_1px_0_#e2e8f0] active:translate-y-[3px] transition-all duration-75";

export default function KaryawanPeersManager() {
  const [tab, setTab] = useState<"karyawan" | "peers">("karyawan");
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
  const [pairType, setPairType] = useState<"peer" | "a_rates_b" | "b_rates_a">("peer");
  const [search, setSearch] = useState("");

  async function load() {
    const [p, c, u, mp] = await Promise.all([
      fetch("/api/feedback/profiles").then((r) => r.json()),
      fetch("/api/feedback/competencies").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/feedback/manual-peers").then((r) => r.json()),
    ]);
    setProfiles(p); setComps(c); setUsers(u); setManualPairs(mp);
  }
  useEffect(() => { load(); }, []);

  const activeComps = useMemo(() => comps.filter((c) => c.active), [comps]);

  function autoIds(dept: string, role: string) {
    const isManager = role === "LEAD" || role === "ADMIN";
    return activeComps.filter((c) =>
      c.category === "CORE" ||
      (c.category === "LEADERSHIP" && isManager) ||
      (c.category === "JOB_FAMILY" && c.department === dept) ||
      (c.category === "TECHNICAL" && c.department == null)
    ).map((c) => c.id);
  }

  function startNew() { setForm({ ...blankForm }); setSelected(new Set()); setEditing("new"); setMsg(""); }
  function startEdit(p: Profile) {
    setForm({ name: p.name, email: p.email, password: "", role: p.role, department: p.department || "", position: p.position || "", level: p.level || "", targetMode: p.targetLevel == null ? "none" : String(p.targetLevel), managerId: p.managerId || "", active: p.active });
    setSelected(new Set(p.competencyIds));
    setEditing(p.id); setMsg("");
  }

  async function save() {
    setMsg("");
    const { targetMode, ...rest } = form;
    const body: Record<string, unknown> = { ...rest, department: form.department || null, managerId: form.managerId || null, isManager: form.role === "LEAD" || form.role === "ADMIN", competencyIds: [...selected] };
    if (targetMode === "none") body.targetLevel = null;
    else if (targetMode !== "auto") body.targetLevel = parseInt(targetMode);
    const res = editing === "new"
      ? await fetch("/api/feedback/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(`/api/feedback/profiles/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setEditing(null); await load(); }
    else { const d = await res.json().catch(() => ({})); setMsg(d.error || "Gagal menyimpan."); }
  }

  async function del(p: Profile) {
    const withUser = confirm(`Hapus profil 360 "${p.name}".\n\nOK = hapus juga akun login.\nCancel = hapus profil 360 saja.`);
    await fetch(`/api/feedback/profiles/${p.id}${withUser ? "?withUser=1" : ""}`, { method: "DELETE" });
    await load();
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setMsg("");
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/feedback/profiles/import", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setImporting(false); if (fileRef.current) fileRef.current.value = "";
    if (res.ok) { setMsg((d.message || "Impor selesai.") + (d.errors ? ` (${d.errors.length} catatan)` : "")); await load(); }
    else setMsg(d.error || "Gagal mengimpor.");
  }

  async function addPair() {
    if (!pairA || !pairB || pairA === pairB) { setMsg("Pilih dua karyawan berbeda."); return; }
    const res = await fetch("/api/feedback/manual-peers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userAId: pairA, userBId: pairB, type: pairType }) });
    if (res.ok) { setPairA(""); setPairB(""); setPairType("peer"); await load(); }
    else { const d = await res.json().catch(() => ({})); setMsg(d.error || "Gagal."); }
  }

  async function removePair(pair: ManualPair) {
    await fetch("/api/feedback/manual-peers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userAId: pair.raterId, userBId: pair.rateeId }) });
    await load();
  }

  const filteredProfiles = profiles.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.department || "").toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filteredProfiles.reduce<Record<string, Profile[]>>((acc, p) => {
    const key = p.department || "(Tanpa Departemen)";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p); return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1 w-fit">
        {(["karyawan", "peers"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "karyawan" ? "🧑‍💼 Karyawan" : "🔗 Penilaian Lintas Dept"}
          </button>
        ))}
      </div>

      {tab === "karyawan" && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={startNew} className={btnPrimary}>➕ Tambah Karyawan</button>
              <a href="/api/feedback/profiles/import" className={btnSecondary}>📋 Download Template</a>
              <button onClick={() => fileRef.current?.click()} disabled={importing} className={`${btnSecondary} ${importing ? "opacity-50 pointer-events-none" : ""}`}>
                {importing ? "⏳ Mengimpor…" : "📤 Bulk Import Excel"}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={doImport} />
            </div>
            <input className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" placeholder="🔍 Cari nama / departemen…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {msg && <p className="text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">{msg}</p>}

          {/* Form */}
          {editing && (
            <div className="bg-white border border-amber-200 rounded-2xl p-6 space-y-4">
              <p className="font-semibold text-slate-800">{editing === "new" ? "➕ Karyawan Baru" : "✏️ Ubah Karyawan"}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Nama*</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Email* (login)</label><input value={form.email} disabled={editing !== "new"} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inp} disabled:bg-slate-50 disabled:text-slate-400`} /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">{editing === "new" ? "Password*" : "Password (kosong = tidak berubah)"}</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Hak Akses</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp}>
                    <option value="MEMBER">Anggota</option><option value="LEAD">Lead</option><option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Departemen</label>
                  <input list="dept-list" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="mis. HR, Finance, Tech…" className={inp} />
                  <datalist id="dept-list">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
                </div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Posisi / Jabatan</label><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Level</label>
                  <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={inp}>
                    <option value="">—</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Target Penilaian</label>
                  <select value={form.targetMode} onChange={(e) => setForm({ ...form, targetMode: e.target.value })} className={inp}>
                    <option value="auto">Otomatis dari level</option><option value="none">Tanpa target</option>
                    <option value="1">Target L1</option><option value="2">Target L2</option><option value="3">Target L3</option><option value="4">Target L4</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1.5">Atasan (superordinate)</label>
                  <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })} className={inp}>
                    <option value="">— tidak ada —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {(form.role === "LEAD" || form.role === "ADMIN") && (
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  Role Lead/Admin otomatis mendapat kompetensi Leadership.
                </p>
              )}

              {/* Competency picker */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Kompetensi yang dinilai ({selected.size})</p>
                  <div className="flex gap-2">
                    <button onClick={() => setSelected((prev) => new Set([...prev, ...autoIds(form.department, form.role)]))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">Terapkan otomatis</button>
                    <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50">Kosongkan</button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">Core (semua) + Leadership (Lead/Admin) + Job Family (sesuai dept) + AI Fluency.</p>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {CATS.map((cat) => {
                    const list = activeComps.filter((c) => c.category === cat && (cat === "CORE" || cat === "LEADERSHIP" || !c.department || c.department === form.department || c.department == null));
                    if (!list.length) return null;
                    return (
                      <div key={cat}>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{CATEGORY_LABEL[cat]}</p>
                        <div className="grid sm:grid-cols-2 gap-1">
                          {list.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600 py-0.5">
                              <input type="checkbox" checked={selected.has(c.id)} onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />
                              <span className="truncate">{c.name}{c.department && <span className="text-[11px] text-slate-400"> · {c.department}</span>}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={save} className={btnPrimary}>💾 Simpan</button>
                <button onClick={() => setEditing(null)} className={btnSecondary}>✕ Batal</button>
              </div>
            </div>
          )}

          {/* List grouped by department */}
          <div className="space-y-4">
            {Object.entries(grouped).map(([dept, emps]) => (
              <div key={dept} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span>🏢</span>
                  <span className="font-semibold text-slate-700 text-sm">{dept}</span>
                  <span className="text-slate-400 text-xs">({emps.length} karyawan)</span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400">Nama</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400">Jabatan</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400">Atasan</th>
                    <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-400">Komp.</th>
                    <th className="px-5 py-2.5" />
                  </tr></thead>
                  <tbody>
                    {emps.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3">
                          <p className={`font-medium ${p.active ? "text-slate-800" : "text-slate-300"}`}>
                            {p.name}
                            {p.isManager && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">lead</span>}
                          </p>
                          <p className="text-[11px] text-slate-400">{p.email}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{p.position || "—"}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{p.managerName || "—"}</td>
                        <td className="px-5 py-3 text-center text-slate-500">{p.competencyIds.length}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(p)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px active:shadow-none transition-all duration-75"><Edit2 size={13} /></button>
                            <button onClick={() => del(p)} className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#fecaca] hover:translate-y-px active:shadow-none transition-all duration-75"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {filteredProfiles.length === 0 && (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-slate-500 text-sm">{profiles.length === 0 ? "Belum ada karyawan. Tambah manual atau bulk import." : "Tidak ada karyawan yang sesuai pencarian."}</p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "peers" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div>
              <p className="font-semibold text-slate-800">Tambah Penilaian Lintas Departemen</p>
              <p className="text-xs text-slate-400 mt-0.5">Assign relasi penilaian antara dua karyawan dari departemen berbeda.</p>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Karyawan A</label>
                <select value={pairA} onChange={(e) => setPairA(e.target.value)} className={inp} style={{ width: 200 }}>
                  <option value="">— pilih —</option>
                  {profiles.filter((p) => p.active).map((p) => <option key={p.userId} value={p.userId}>{p.name} ({p.department || "—"})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipe Relasi</label>
                <select value={pairType} onChange={(e) => setPairType(e.target.value as typeof pairType)} className={inp} style={{ width: 230 }}>
                  <option value="peer">🤝 Peer (A ↔ B, saling menilai)</option>
                  <option value="a_rates_b">⬆️ A menilai B (A adalah atasan B)</option>
                  <option value="b_rates_a">⬇️ B menilai A (B adalah atasan A)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Karyawan B</label>
                <select value={pairB} onChange={(e) => setPairB(e.target.value)} className={inp} style={{ width: 200 }}>
                  <option value="">— pilih —</option>
                  {profiles.filter((p) => p.active && p.userId !== pairA).map((p) => <option key={p.userId} value={p.userId}>{p.name} ({p.department || "—"})</option>)}
                </select>
              </div>
              <button onClick={addPair} className={btnPrimary}>➕ Tambah</button>
            </div>
          </div>

          {manualPairs.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <span className="font-semibold text-slate-700 text-sm">🔗 Penilaian Lintas Departemen ({manualPairs.length})</span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400">Karyawan A</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-400">Relasi</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400">Karyawan B</th>
                  <th className="px-5 py-2.5" />
                </tr></thead>
                <tbody>
                  {manualPairs.map((pair) => (
                    <tr key={pair.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-800">{pair.raterName}</td>
                      <td className="px-3 py-3 text-center">
                        {pair.isPeer
                          ? <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">🤝 Peer</span>
                          : <span className="text-xs font-semibold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">⬆️ Atasan Lintas Dept</span>
                        }
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">{pair.rateeName}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => removePair(pair)} className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 shadow-[0_2px_0_#e2e8f0] hover:translate-y-px transition-all duration-75"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">🔗</div>
              <p className="text-slate-500 text-sm">Belum ada penilaian lintas departemen.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
