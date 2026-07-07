"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronDown, ChevronUp, CheckSquare, Square, X, Key } from "lucide-react";
import { calcObjectiveAchievement, calcKRAchievement } from "@/lib/calculations";

type KeyResult = {
  id: string;
  title: string;
  target: number;
  unit: string;
  weight: number;
  teamProgress: number;
  leadProgress: number | null;
};

type Objective = {
  id: string;
  title: string;
  weight: number;
  status: "DRAFT" | "SUBMITTED";
  submittedAt: string | null;
  keyResults: KeyResult[];
};

type Quarter = {
  id: string;
  name: string;
  year: number;
  quarter: number;
};

type Props = {
  initialObjectives: Objective[];
  quarterId: string;
  userId: string;
  allQuarters: Quarter[];
  isLead?: boolean;
};

const UNITS = ["%", "pcs", "x", "score", "day", "month", "people", "other"];

const btnPrimary =
  "flex items-center gap-2 bg-[#0b8ec4] text-white hover:bg-[#097eb9] font-bold text-sm px-4 py-2 rounded-xl " +
  "shadow-sm hover:shadow-sm " +
  "active:shadow-sm " +
  "disabled:opacity-50 transition-all duration-75";

const btnSecondary =
  "flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold text-sm px-4 py-2 rounded-xl " +
  "shadow-sm hover:shadow-sm " +
  "active:shadow-sm transition-all duration-75";

const btnDanger =
  "text-slate-300 hover:text-red-500 transition-colors duration-100";

// ─── Weight bar ───────────────────────────────────────────────────────────────

function WeightBar({ objectives }: { objectives: Objective[] }) {
  const total = objectives.reduce((s, o) => s + Number(o.weight), 0);
  const isOk = Math.abs(total - 100) <= 0.01;
  const colors = [
    "bg-amber-400", "bg-blue-400", "bg-emerald-400",
    "bg-violet-400", "bg-rose-400", "bg-cyan-400",
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-700 text-sm">Objective Weight Distribution</h2>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
          total === 0 ? "bg-slate-100 text-slate-500"
          : isOk ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-600"
        }`}>
          {total}%{isOk ? "" : total > 0 ? " · must be 100%" : ""}
        </span>
      </div>

      {objectives.length > 0 && (
        <>
          <div className="h-3 rounded-full overflow-hidden flex gap-px mb-3 bg-slate-100">
            {objectives.map((obj, i) => (
              <div
                key={obj.id}
                className={`${colors[i % colors.length]} h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${Math.max(Number(obj.weight), 0)}%` }}
                title={`${obj.title}: ${obj.weight}%`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-1">
            {objectives.map((obj, i) => (
              <div key={obj.id} className="flex items-start gap-1.5 text-xs min-w-0">
                <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-0.5 ${colors[i % colors.length]}`} />
                <span className="text-slate-600 break-words flex-1">{obj.title}</span>
                <span className="font-bold text-slate-700 flex-shrink-0 ml-1">{obj.weight}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

type KRSelection = Record<string, Set<string>>; // objectiveId → selected KR ids

function ImportModal({
  currentQuarterId,
  allQuarters,
  onImport,
  onClose,
}: {
  currentQuarterId: string;
  allQuarters: Quarter[];
  onImport: (newObjs: Objective[]) => void;
  onClose: () => void;
}) {
  const otherQuarters = allQuarters.filter((q) => q.id !== currentQuarterId);
  const [sourceId, setSourceId] = useState(otherQuarters[0]?.id ?? "");
  const [sourceObjs, setSourceObjs] = useState<Objective[]>([]);
  const [loadingObjs, setLoadingObjs] = useState(false);
  const [selectedKRs, setSelectedKRs] = useState<KRSelection>({});
  const [expandedObjs, setExpandedObjs] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Auto-load objectives when modal first opens
  useEffect(() => {
    if (sourceId) loadObjectives(sourceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadObjectives(qId: string) {
    setSourceId(qId);
    setSelectedKRs({});
    setExpandedObjs(new Set());
    if (!qId) { setSourceObjs([]); return; }
    setLoadingObjs(true);
    const res = await fetch(`/api/objectives?quarterId=${qId}`);
    if (res.ok) {
      const data: Objective[] = await res.json();
      setSourceObjs(data);
      // Select all objectives + all KRs by default
      const init: KRSelection = {};
      data.forEach((obj) => { init[obj.id] = new Set(obj.keyResults.map((kr) => kr.id)); });
      setSelectedKRs(init);
    }
    setLoadingObjs(false);
  }

  const isObjSelected = (id: string) => (selectedKRs[id]?.size ?? 0) > 0;

  function toggleObj(obj: Objective) {
    setSelectedKRs((prev) => {
      const next = { ...prev };
      if (isObjSelected(obj.id)) { delete next[obj.id]; }
      else { next[obj.id] = new Set(obj.keyResults.map((kr) => kr.id)); }
      return next;
    });
  }

  function toggleKR(objId: string, krId: string) {
    setSelectedKRs((prev) => {
      const next = { ...prev };
      const set = new Set(prev[objId] ?? []);
      if (set.has(krId)) set.delete(krId); else set.add(krId);
      if (set.size === 0) delete next[objId]; else next[objId] = set;
      return next;
    });
  }

  function toggleAllObjs() {
    const anySelected = sourceObjs.some((o) => isObjSelected(o.id));
    if (anySelected) { setSelectedKRs({}); }
    else {
      const init: KRSelection = {};
      sourceObjs.forEach((obj) => { init[obj.id] = new Set(obj.keyResults.map((kr) => kr.id)); });
      setSelectedKRs(init);
    }
  }

  function toggleExpandObj(id: string) {
    setExpandedObjs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedObjCount = sourceObjs.filter((o) => isObjSelected(o.id)).length;
  const selectedKRCount = Object.values(selectedKRs).reduce((s, set) => s + set.size, 0);

  async function doImport() {
    if (selectedObjCount === 0) return;
    setImporting(true);
    const selections = sourceObjs
      .filter((o) => isObjSelected(o.id))
      .map((o) => ({ objectiveId: o.id, keyResultIds: [...(selectedKRs[o.id] ?? [])] }));
    const res = await fetch("/api/okr/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromQuarterId: sourceId, toQuarterId: currentQuarterId, selections }),
    });
    if (res.ok) { onImport(await res.json()); onClose(); }
    else { alert((await res.json()).error ?? "Failed to import OKRs"); }
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Import OKR from Another Quarter</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Destination indicator */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
            <span></span>
            <span>Objectives to be imported into this quarter: <strong>{allQuarters.find((q) => q.id === currentQuarterId)?.name ?? currentQuarterId}</strong></span>
          </div>

          {otherQuarters.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No other quarters available.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Select Source Quarter (copy from)</label>
                <select value={sourceId} onChange={(e) => loadObjectives(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                  <option value="">-- Select Quarter --</option>
                  {otherQuarters.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </div>

              {loadingObjs && <p className="text-slate-400 text-sm text-center py-4">Loading objectives...</p>}
              {!loadingObjs && sourceId && sourceObjs.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">No objectives in this quarter.</p>
              )}

              {!loadingObjs && sourceObjs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">
                      {selectedObjCount} obj · {selectedKRCount} KR dipilih
                    </span>
                    <button onClick={toggleAllObjs} className="text-xs text-amber-600 font-bold hover:text-amber-700">
                      {sourceObjs.some((o) => isObjSelected(o.id)) ? "Cancel all" : "Select all"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sourceObjs.map((obj) => {
                      const objSel = isObjSelected(obj.id);
                      const expanded = expandedObjs.has(obj.id);
                      const krCount = selectedKRs[obj.id]?.size ?? 0;
                      return (
                        <div key={obj.id} className={`rounded-xl border transition-colors ${objSel ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
                          <div className="flex items-center gap-2 p-3">
                            <button onClick={() => toggleObj(obj)} className="flex-shrink-0">
                              {objSel ? <CheckSquare size={16} className="text-amber-500" /> : <Square size={16} className="text-slate-300" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 break-words">{obj.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                weight {obj.weight}% · <span className={krCount > 0 ? "text-amber-600 font-medium" : ""}>{krCount}/{obj.keyResults.length} KR</span>
                              </p>
                            </div>
                            {obj.keyResults.length > 0 && (
                              <button onClick={() => toggleExpandObj(obj.id)}
                                className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition">
                                <Key size={11} />
                                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            )}
                          </div>

                          {expanded && obj.keyResults.length > 0 && (
                            <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-1.5">
                              {obj.keyResults.map((kr) => {
                                const krSel = selectedKRs[obj.id]?.has(kr.id) ?? false;
                                return (
                                  <button key={kr.id} onClick={() => toggleKR(obj.id, kr.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${krSel ? "bg-amber-100 border border-amber-200" : "bg-white border border-slate-100 hover:bg-slate-50"}`}>
                                    {krSel ? <CheckSquare size={13} className="text-amber-500 flex-shrink-0" /> : <Square size={13} className="text-slate-300 flex-shrink-0" />}
                                    <span className="text-xs text-slate-700 break-words flex-1">{kr.title}</span>
                                    <span className="text-xs text-slate-400 flex-shrink-0">{kr.target} {kr.unit}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">Objective diimpor ke <strong>{allQuarters.find((q) => q.id === currentQuarterId)?.name}</strong> as a new DRAFT. Progress from the source quarter <strong>is not copied</strong> (starting from 0).</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={doImport} disabled={importing || selectedObjCount === 0} className={btnPrimary}>
            {importing ? "Importing..." : `Import ${selectedObjCount > 0 ? `(${selectedObjCount} obj, ${selectedKRCount} KR)` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OKRManager({ initialObjectives, quarterId, userId, allQuarters, isLead }: Props) {
  const router = useRouter();
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Bulk delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Import modal
  const [showImport, setShowImport] = useState(false);

  const allSubmitted = objectives.length > 0 && objectives.every((o) => o.status === "SUBMITTED");
  const someSubmitted = objectives.some((o) => o.status === "SUBMITTED");
  const totalWeight = objectives.reduce((s, o) => s + Number(o.weight), 0);
  const weightOk = Math.abs(totalWeight - 100) <= 0.01;

  // ── Select mode helpers ──────────────────────────────────────────────────────

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const draftIds = objectives.filter((o) => o.status === "DRAFT").map((o) => o.id);
    setSelectedIds(new Set(draftIds));
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} objective beserta all key result-nya?`)) return;
    setBulkDeleting(true);
    await Promise.all(
      [...selectedIds].map((id) => fetch(`/api/objectives/${id}`, { method: "DELETE" }))
    );
    setObjectives((prev) => prev.filter((o) => !selectedIds.has(o.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkDeleting(false);
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async function addObjective() {
    const res = await fetch("/api/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New objective", weight: 0, quarterId, userId }),
    });
    const obj = await res.json();
    setObjectives((prev) => [...prev, { ...obj, keyResults: [] }]);
    setExpanded((prev) => ({ ...prev, [obj.id]: true }));
    router.refresh(); // update DistribusiAnggota's objectives prop
  }

  async function updateObjective(id: string, data: Partial<Objective>) {
    setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...data } : o)));
  }

  async function saveObjective(obj: Objective) {
    setSaving(true);
    await fetch(`/api/objectives/${obj.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: obj.title, weight: Number(obj.weight) }),
    });
    setSaving(false);
  }

  async function deleteObjective(id: string) {
    if (!confirm("Delete this objective along with all of its key results?")) return;
    const res = await fetch(`/api/objectives/${id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json()).error); return; }
    setObjectives((prev) => prev.filter((o) => o.id !== id));
    router.refresh();
  }

  async function submitAllOKR() {
    if (!weightOk) { alert("Total objective weight must be 100% before submitting."); return; }
    if (!confirm("Review the OKRs below before submitting.\n\nAfter submitting, OKRs can still be changed by returning to Draft status.\n\nSubmit the OKRs now?")) return;
    setSaving(true);
    for (const obj of objectives.filter((o) => o.status === "DRAFT")) {
      await fetch(`/api/objectives/${obj.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });
    }
    setSaving(false);
    setObjectives((prev) => prev.map((o) => ({ ...o, status: "SUBMITTED" as const, submittedAt: new Date().toISOString() })));
    router.refresh();
  }

  async function recallOKR(id: string) {
    if (!confirm("Pull this OKR back to draft?")) return;
    await fetch(`/api/objectives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    });
    setObjectives((prev) => prev.map((o) => o.id === id ? { ...o, status: "DRAFT", submittedAt: null } : o));
  }

  async function addKeyResult(objectiveId: string) {
    const res = await fetch("/api/key-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New key result", target: 100, unit: "%", weight: 0, objectiveId }),
    });
    const kr = await res.json();
    setObjectives((prev) => prev.map((o) => o.id === objectiveId ? { ...o, keyResults: [...o.keyResults, kr] } : o));
  }

  async function updateKR(objectiveId: string, krId: string, data: Partial<KeyResult>) {
    setObjectives((prev) =>
      prev.map((o) =>
        o.id === objectiveId
          ? { ...o, keyResults: o.keyResults.map((kr) => (kr.id === krId ? { ...kr, ...data } : kr)) }
          : o
      )
    );
  }

  async function saveKR(kr: KeyResult) {
    setSaving(true);
    await fetch(`/api/key-results/${kr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: kr.title, target: Number(kr.target), unit: kr.unit, weight: Number(kr.weight) }),
    });
    setSaving(false);
  }

  async function saveLeadProgress(krId: string, value: number | null) {
    await fetch(`/api/key-results/${krId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadProgress: value }),
    });
  }

  async function deleteKR(objectiveId: string, krId: string) {
    if (!confirm("Delete this key result?")) return;
    await fetch(`/api/key-results/${krId}`, { method: "DELETE" });
    setObjectives((prev) => prev.map((o) => o.id === objectiveId ? { ...o, keyResults: o.keyResults.filter((kr) => kr.id !== krId) } : o));
  }

  const draftObjectives = objectives.filter((o) => o.status === "DRAFT");

  return (
    <>
      {showImport && (
        <ImportModal
          currentQuarterId={quarterId}
          allQuarters={allQuarters}
          onImport={(newObjs) => {
            setObjectives((prev) => [...prev, ...newObjs]);
            newObjs.forEach((o) => setExpanded((p) => ({ ...p, [o.id]: true })));
            router.refresh(); // update DistribusiAnggota's objectives prop
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      <div className="space-y-4">
        <WeightBar objectives={objectives} />

        {/* Quarter sanity banner */}
        {allQuarters.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-500">
            <span></span>
            <span>Quarter being edited: <strong className="text-slate-700">{allQuarters.find((q) => q.id === quarterId)?.name ?? quarterId}</strong></span>
          </div>
        )}

        {/* Status banners */}
        {allSubmitted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-lg"></span>
            <div>
              <p className="font-semibold text-green-700 text-sm">All OKRs submitted!</p>
              <p className="text-green-600 text-xs mt-0.5">Progress is filled in by members in the Member Distribution section below.</p>
            </div>
          </div>
        ) : someSubmitted ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-lg">ℹ</span>
            <p className="text-blue-700 text-sm">Some OKRs are already submitted. Finish all objectives, then submit.</p>
          </div>
        ) : null}

        {/* Action bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-slate-400 space-y-0.5">
            <p>{saving ? "Saving..." : "Saved automatically"}</p>
            {!allSubmitted && <p className="text-amber-500 font-medium">Saved ≠ submitted. Click "Submit OKR" when everything is done.</p>}
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            {/* Bulk delete controls */}
            {!allSubmitted && draftObjectives.length > 0 && (
              selectMode ? (
                <>
                  <button
                    onClick={selectAll}
                    className={btnSecondary}
                  >
                    Select All ({draftObjectives.length})
                  </button>
                  <button
                    onClick={bulkDelete}
                    disabled={bulkDeleting || selectedIds.size === 0}
                    className="flex items-center gap-2 bg-red-500 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm hover:shadow-sm active:shadow-sm disabled:opacity-50 transition-all duration-75"
                  >
                    <Trash2 size={14} />
                    {bulkDeleting ? "Deleting..." : `Delete (${selectedIds.size})`}
                  </button>
                  <button onClick={toggleSelectMode} className={btnSecondary}>
                    <X size={14} /> Cancel
                  </button>
                </>
              ) : (
                <button onClick={toggleSelectMode} className={btnSecondary}>
                  <CheckSquare size={14} /> Select
                </button>
              )
            )}

            {/* Import button */}
            {!allSubmitted && allQuarters.length > 1 && (
              <button onClick={() => setShowImport(true)} className={btnSecondary}>
                Import dari Quarter Lain
              </button>
            )}

            {/* Add objective */}
            {!allSubmitted && !selectMode && (
              <button onClick={addObjective} className={btnSecondary}>
                Add Objective
              </button>
            )}

            {/* Submit all */}
            {objectives.length > 0 && !allSubmitted && !selectMode && (
              <button onClick={submitAllOKR} disabled={saving || !weightOk} className={btnPrimary}>
                Kumpulkan OKR
              </button>
            )}
          </div>
        </div>

        {/* Empty */}
        {objectives.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3"></div>
            <p className="text-slate-500 text-sm">No objectives. Click "Add Objective" or import from a previous quarter.</p>
          </div>
        )}

        {/* Objective cards */}
        {objectives.map((obj, objIdx) => {
          const isLocked = obj.status === "SUBMITTED";
          const isDraft = obj.status === "DRAFT";
          const krTotalWeight = obj.keyResults.reduce((s, kr) => s + Number(kr.weight), 0);
          const krWeightOk = Math.abs(krTotalWeight - 100) <= 0.01;
          const isExpanded = expanded[obj.id] ?? false;
          const achievement = calcObjectiveAchievement(obj);
          const isSelected = selectedIds.has(obj.id);

          return (
            <div
              key={obj.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
                isSelected ? "border-red-300 ring-2 ring-red-200"
                : isLocked ? "border-green-200"
                : "border-slate-200"
              }`}
            >
              {/* Objective header */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                {/* Checkbox in select mode (only for DRAFT) */}
                {selectMode && isDraft && (
                  <button
                    onClick={() => toggleSelect(obj.id)}
                    className="flex-shrink-0 text-slate-400 hover:text-amber-500 transition"
                  >
                    {isSelected
                      ? <CheckSquare size={17} className="text-red-500" />
                      : <Square size={17} />
                    }
                  </button>
                )}

                <button
                  onClick={() => setExpanded((p) => ({ ...p, [obj.id]: !p[obj.id] }))}
                  className="text-slate-400 hover:text-slate-600 transition flex-shrink-0 mt-0.5"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <span className="w-6 h-6 rounded-full bg-[#0b8ec4] text-white hover:bg-[#097eb9] text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  {objIdx + 1}
                </span>

                <textarea
                  className="flex-1 font-semibold text-slate-800 text-sm border-b border-transparent hover:border-slate-200 focus:border-amber-400 focus:outline-none bg-transparent py-0.5 disabled:cursor-default disabled:text-slate-600 resize-none overflow-hidden leading-snug"
                  rows={1}
                  value={obj.title}
                  disabled={isLocked}
                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                  onChange={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; updateObjective(obj.id, { title: e.target.value }); }}
                  onBlur={() => !isLocked && saveObjective(obj)}
                />

                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <span className="text-xs text-slate-400">Weight</span>
                  <input
                    type="number"
                    className="w-14 text-right border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:cursor-default"
                    value={obj.weight}
                    disabled={isLocked}
                    onChange={(e) => updateObjective(obj.id, { weight: Number(e.target.value) })}
                    onBlur={() => !isLocked && saveObjective(obj)}
                    min={0} max={100}
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>

                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 mt-0.5 ${
                  achievement >= 100 ? "bg-green-100 text-green-700"
                  : achievement >= 70 ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-600"
                }`}>
                  {achievement >= 100 ? "" : achievement >= 70 ? "" : ""} {achievement.toFixed(0)}%
                </span>

                {isLocked ? (
                  <button
                    onClick={() => recallOKR(obj.id)}
                    className="text-slate-400 hover:text-orange-500 transition flex-shrink-0 text-base mt-0.5"
                    title="Pull back to draft"
                  ></button>
                ) : (
                  !selectMode && (
                    <button onClick={() => deleteObjective(obj.id)} className={`${btnDanger} flex-shrink-0 mt-0.5`}>
                      <Trash2 size={15} />
                    </button>
                  )
                )}
              </div>

              {/* Progress bar */}
              <div className="px-4 pb-2">
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-1 rounded-full transition-all ${
                      achievement >= 100 ? "bg-green-500" : achievement >= 70 ? "bg-amber-400" : "bg-red-400"
                    }`}
                    style={{ width: `${Math.min(achievement, 100)}%` }}
                  />
                </div>
              </div>

              {/* Key Results */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">Weight KR: {krTotalWeight}%</span>
                      {obj.keyResults.length > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          krWeightOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {krWeightOk ? "" : "must be 100%"}
                        </span>
                      )}
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => addKeyResult(obj.id)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-bold bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg
                          shadow-sm hover:shadow-sm
                          transition-all duration-75"
                      >
                        Add KR
                      </button>
                    )}
                  </div>

                  {obj.keyResults.length === 0 && (
                    <p className="text-slate-400 text-sm text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                      No key result.
                    </p>
                  )}

                  <div className="space-y-2">
                    {obj.keyResults.map((kr, krIdx) => {
                      const pct = calcKRAchievement(kr);
                      return (
                        <div key={kr.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5 flex-shrink-0 min-w-[2rem] text-center">
                              {objIdx + 1}.{krIdx + 1}
                            </span>
                            <textarea
                              className="flex-1 text-sm font-medium text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-amber-400 focus:outline-none disabled:cursor-default resize-none overflow-hidden leading-snug"
                              rows={1}
                              value={kr.title}
                              disabled={isLocked}
                              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                              onChange={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; updateKR(obj.id, kr.id, { title: e.target.value }); }}
                              onBlur={() => !isLocked && saveKR(kr)}
                              placeholder="Judul Key Result"
                            />
                            {!isLocked && (
                              <button onClick={() => deleteKR(obj.id, kr.id)} className={`${btnDanger} flex-shrink-0`}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                            <div>
                              <label className="block text-slate-400 mb-1 font-medium">Target</label>
                              <input
                                type="number"
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400 bg-white disabled:bg-slate-50 disabled:cursor-default"
                                value={kr.target}
                                disabled={isLocked}
                                onChange={(e) => updateKR(obj.id, kr.id, { target: Number(e.target.value) })}
                                onBlur={() => !isLocked && saveKR(kr)}
                                min={0}
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 mb-1 font-medium">Satuan</label>
                              <select
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400 bg-white disabled:cursor-default"
                                value={kr.unit}
                                disabled={isLocked}
                                onChange={(e) => updateKR(obj.id, kr.id, { unit: e.target.value })}
                                onBlur={() => !isLocked && saveKR(kr)}
                              >
                                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-400 mb-1 font-medium">Weight (%)</label>
                              <input
                                type="number"
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400 bg-white disabled:bg-slate-50 disabled:cursor-default"
                                value={kr.weight}
                                disabled={isLocked}
                                onChange={(e) => updateKR(obj.id, kr.id, { weight: Number(e.target.value) })}
                                onBlur={() => !isLocked && saveKR(kr)}
                                min={0} max={100}
                              />
                            </div>
                          </div>

                          {isLead ? (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-blue-600 flex-shrink-0">Division Lead Contribution</span>
                              <input
                                type="number"
                                className="w-20 border border-blue-200 rounded-lg px-2 py-1 text-xs text-right bg-blue-50 focus:outline-none focus:border-blue-400"
                                value={kr.leadProgress ?? ""}
                                placeholder="0"
                                min={0}
                                onChange={(e) => {
                                  const v = e.target.value === "" ? null : Number(e.target.value);
                                  updateKR(obj.id, kr.id, { leadProgress: v });
                                }}
                                onBlur={(e) => {
                                  const v = e.target.value === "" ? null : Number(e.target.value);
                                  saveLeadProgress(kr.id, v);
                                }}
                              />
                              <span className="text-xs text-slate-400">/ {kr.target} {kr.unit}</span>
                              {(kr.leadProgress ?? 0) > 0 && (
                                <button
                                  onClick={() => { updateKR(obj.id, kr.id, { leadProgress: null }); saveLeadProgress(kr.id, null); }}
                                  className="text-slate-300 hover:text-slate-500 text-xs transition"
                                  title="Reset contribution"
                                ></button>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic mb-2">
                              Member progress is filled in on the{" "}
                              <a href="/distribusi" className="text-amber-600 hover:underline font-semibold">Distribusi Member →</a>
                            </p>
                          )}

                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
