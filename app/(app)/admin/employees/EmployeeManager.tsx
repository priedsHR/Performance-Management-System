"use client";

import { useRef, useState } from "react";
import { Trash2, Edit2, ToggleLeft, ToggleRight } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  division: string | null;
  position: string | null;
  isActive: boolean;
  createdAt: string;
};

type FormState = { name: string; division: string; position: string; isActive: boolean };
const emptyForm: FormState = { name: "", division: "", position: "", isActive: true };

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white transition";
const btnPrimary = "flex items-center gap-2 bg-amber-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0_#097eb9] hover:shadow-[0_2px_0_#097eb9] hover:translate-y-0.5 active:shadow-[0_1px_0_#097eb9] active:translate-y-[3px] transition-all duration-75";
const btnSecondary = "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-[0_4px_0_#e2e8f0] hover:shadow-[0_2px_0_#e2e8f0] hover:translate-y-0.5 active:shadow-[0_1px_0_#e2e8f0] active:translate-y-[3px] transition-all duration-75";

function EmployeeForm({ form, isEdit, onChange, onSave, onCancel }: {
  form: FormState; isEdit: boolean;
  onChange: (f: FormState) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-6 mb-5">
      <h2 className="font-semibold text-slate-800 mb-4">{isEdit ? "✏️ Edit Karyawan" : "➕ Karyawan Baru"}</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">👤 Nama*</label>
          <input className={inputCls} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} placeholder="Nama lengkap" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">🏢 Divisi</label>
          <input className={inputCls} value={form.division} onChange={(e) => onChange({ ...form, division: e.target.value })} placeholder="contoh: HR, Marketing, Finance" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">💼 Jabatan / Posisi</label>
          <input className={inputCls} value={form.position} onChange={(e) => onChange({ ...form, position: e.target.value })} placeholder="contoh: Recruiter, HRBP, Content Creator" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">📌 Status</label>
          <select className={inputCls} value={form.isActive ? "true" : "false"} onChange={(e) => onChange({ ...form, isActive: e.target.value === "true" })}>
            <option value="true">✅ Aktif</option>
            <option value="false">⏸️ Non-aktif</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onSave} className={btnPrimary}>💾 Simpan</button>
        <button onClick={onCancel} className={btnSecondary}>✕ Batal</button>
      </div>
    </div>
  );
}

export default function EmployeeManager({ initialEmployees }: { initialEmployees: Employee[] }) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [importResult, setImportResult] = useState<{ type: "success" | "error"; message: string; errors?: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");

  function cancel() { setShowForm(false); setEditId(null); setForm(emptyForm); }

  async function createEmployee() {
    if (!form.name.trim()) { alert("Nama wajib diisi."); return; }
    const res = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { alert((await res.json()).error ?? "Gagal membuat karyawan"); return; }
    const emp = await res.json();
    setEmployees((prev) => [...prev, emp].sort((a, b) => (a.division ?? "").localeCompare(b.division ?? "") || a.name.localeCompare(b.name)));
    cancel();
  }

  async function updateEmployee() {
    if (!editId) return;
    const res = await fetch(`/api/employees/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const updated = await res.json();
    setEmployees((prev) => prev.map((e) => e.id === editId ? updated : e));
    cancel();
  }

  async function deleteEmployee(id: string) {
    if (!confirm("Hapus karyawan ini dari daftar?")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }

  async function toggleActive(emp: Employee) {
    const res = await fetch(`/api/employees/${emp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !emp.isActive }) });
    const updated = await res.json();
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? updated : e));
  }

  function startEdit(emp: Employee) {
    setEditId(emp.id);
    setShowForm(false);
    setForm({ name: emp.name, division: emp.division ?? "", position: emp.position ?? "", isActive: emp.isActive });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/employees/import", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult({ type: "success", message: data.message, errors: data.errors });
        // Reload employees
        const reloaded = await fetch("/api/employees").then((r) => r.json());
        setEmployees(Array.isArray(reloaded) ? reloaded : []);
      } else {
        setImportResult({ type: "error", message: data.error ?? "Import gagal.", errors: data.errors });
      }
    } catch {
      setImportResult({ type: "error", message: "Terjadi kesalahan jaringan." });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filtered = employees.filter((e) => {
    if (filter === "active" && !e.isActive) return false;
    if (filter === "inactive" && e.isActive) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !(e.division ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Employee[]>>((acc, e) => {
    const key = e.division || "(Tanpa Divisi)";
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const activeCount = employees.filter((e) => e.isActive).length;
  const inactiveCount = employees.filter((e) => !e.isActive).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setShowForm((v) => !v); setEditId(null); setForm(emptyForm); }} className={btnPrimary}>
            ➕ Tambah Karyawan
          </button>
          <a href="/api/employees/import" className={btnSecondary}>📋 Download Template</a>
          <label className={`${btnSecondary} cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            {importing ? "⏳ Mengimpor..." : "📤 Bulk Import Excel"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            placeholder="🔍 Cari nama / divisi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex bg-slate-100 p-1 rounded-lg gap-0.5 text-xs font-semibold">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md transition-all ${filter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {f === "all" ? `Semua (${employees.length})` : f === "active" ? `✅ Aktif (${activeCount})` : `⏸️ Non-aktif (${inactiveCount})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {importResult && (
        <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${importResult.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          <p className="font-semibold">{importResult.type === "success" ? "✅" : "❌"} {importResult.message}</p>
          {importResult.errors?.map((e, i) => <p key={i} className="text-xs mt-0.5">{e}</p>)}
        </div>
      )}

      {showForm && <EmployeeForm form={form} isEdit={false} onChange={setForm} onSave={createEmployee} onCancel={cancel} />}
      {editId && <EmployeeForm form={form} isEdit={true} onChange={setForm} onSave={updateEmployee} onCancel={cancel} />}

      {/* Employee list grouped by division */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([division, emps]) => (
          <div key={division} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span className="font-semibold text-slate-700 text-sm">{division}</span>
              <span className="text-slate-400 text-xs">({emps.length} karyawan)</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400">Nama</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400">Jabatan</th>
                  <th className="text-center px-5 py-2.5 text-xs font-semibold text-slate-400">Status</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {emps.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 font-medium text-slate-800">{emp.name}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{emp.position || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleActive(emp)} title={emp.isActive ? "Klik untuk non-aktifkan" : "Klik untuk aktifkan"}
                        className="transition-transform hover:scale-110">
                        {emp.isActive
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-lg"><ToggleRight size={14} /> Aktif</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg"><ToggleLeft size={14} /> Non-aktif</span>
                        }
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(emp)}
                          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px active:shadow-none active:translate-y-[2px] transition-all duration-75">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteEmployee(emp.id)}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#fecaca] hover:translate-y-px active:shadow-none active:translate-y-[2px] transition-all duration-75">
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

        {filtered.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-slate-500 text-sm">
              {employees.length === 0 ? "Belum ada karyawan. Tambah manual atau bulk import dari Excel." : "Tidak ada karyawan yang sesuai filter."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
