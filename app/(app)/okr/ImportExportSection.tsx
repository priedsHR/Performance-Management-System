"use client";

import { useRef, useState } from "react";

type RawRow = Record<string, string>;
type PreviewData = {
  sheetNames: string[];
  selectedSheet: string;
  maxRow: number;
  rawRows: RawRow[];
  error?: string;
};

type Props = { quarterId: string };

export default function ImportExportSection({ quarterId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    detail?: string;
    debug?: string;
  } | null>(null);

  function handleTemplate() {
    window.location.href = "/api/okr/template";
  }

  function handleExport() {
    window.location.href = `/api/okr/export?quarterId=${quarterId}`;
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("quarterId", quarterId);
    try {
      const res = await fetch("/api/okr/import", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.success) {
        const debugInfo = data.debug
          ? `${data.debug.rowsParsed} baris terbaca` + (data.debug.skipped?.length ? `, ${data.debug.skipped.length} dilewati` : "")
          : undefined;
        setResult({ type: "success", message: data.message, detail: data.errors?.join("; "), debug: debugInfo });
        setTimeout(() => window.location.reload(), 1400);
      } else {
        setResult({ type: "error", message: data.error ?? "Import failed.", debug: data.debug ? JSON.stringify(data.debug) : undefined });
      }
    } catch {
      setResult({ type: "error", message: "A network error occurred." });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePreview(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewing(true);
    setPreview(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/okr/import/preview", { method: "POST", body: form });
      const data = await res.json();
      setPreview(data);
    } catch {
      setPreview({ sheetNames: [], selectedSheet: "", maxRow: 0, rawRows: [], error: "Failed to read the file." });
    } finally {
      setPreviewing(false);
      if (previewRef.current) previewRef.current.value = "";
    }
  }

  const btnBase = "flex items-center gap-2 font-bold text-sm px-4 py-2 rounded-xl transition-all duration-75 ";
  const btnAmber = btnBase + "bg-amber-400 text-white shadow-[0_4px_0_#097eb9] hover:shadow-[0_2px_0_#097eb9] hover:translate-y-0.5 active:shadow-[0_1px_0_#097eb9] active:translate-y-[3px] disabled:opacity-50 disabled:shadow-none disabled:translate-y-0";
  const btnSlate = btnBase + "bg-white text-slate-700 border border-slate-200 shadow-[0_4px_0_#e2e8f0] hover:shadow-[0_2px_0_#e2e8f0] hover:translate-y-0.5 active:shadow-[0_1px_0_#e2e8f0] active:translate-y-[3px]";
  const btnGreen = btnBase + "bg-emerald-500 text-white shadow-[0_4px_0_#059669] hover:shadow-[0_2px_0_#059669] hover:translate-y-0.5 active:shadow-[0_1px_0_#059669] active:translate-y-[3px]";
  const btnViolet = btnBase + "bg-violet-100 text-violet-700 border border-violet-200 shadow-[0_4px_0_#ddd6fe] hover:shadow-[0_2px_0_#ddd6fe] hover:translate-y-0.5 active:shadow-[0_1px_0_#ddd6fe] active:translate-y-[3px]";

  return (
    <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleTemplate} className={btnSlate}>📋 Download Template</button>

          <label className={btnAmber + " cursor-pointer"}>
            {importing ? <><span className="animate-spin">⏳</span> Importing…</> : <>📤 Import Excel</>}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>

          <button onClick={handleExport} className={btnGreen}>📥 Export OKR</button>

          <label className={btnViolet + " cursor-pointer"} title="Preview the file before importing — no data is changed">
            {previewing ? <><span className="animate-spin">⏳</span> Membaca…</> : <>🔍 Preview File</>}
            <input ref={previewRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handlePreview} disabled={previewing} />
          </label>
        </div>

        {result && (
          <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${
            result.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            <span className="text-base flex-shrink-0">{result.type === "success" ? "✅" : "❌"}</span>
            <div>
              <p className="font-semibold">{result.message}</p>
              {result.detail && <p className="text-xs mt-0.5 opacity-75">{result.detail}</p>}
              {result.debug && <p className="text-xs mt-1 opacity-60 font-mono bg-black/5 px-2 py-1 rounded">{result.debug}</p>}
              {result.type === "success" && <p className="text-xs mt-0.5 opacity-75">The page will reload…</p>}
            </div>
          </div>
        )}

        {/* Preview panel */}
        {preview && (

          <div className="border border-violet-200 rounded-xl overflow-hidden">
            <div className="bg-violet-50 px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-violet-800">🔍 Isi File — {preview.selectedSheet}</p>
                <p className="text-xs text-violet-500">
                  Sheets: {preview.sheetNames.join(", ")} · {preview.maxRow} baris total
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="text-violet-400 hover:text-violet-700 text-lg">✕</button>
            </div>
            {preview.error && (
              <p className="px-4 py-3 text-sm text-red-600">{preview.error}</p>
            )}
            {preview.rawRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["#", "A (Objective)", "B (Weight Obj)", "C (Key Result)", "D (Target)", "E (Satuan)", "F (Weight KR)"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rawRows.map((row, i) => {
                      const isHeader = row.rowNum === "1";
                      const isExample = row.rowNum === "2";
                      const hasKR = row.C_str && row.C_str !== "(empty)";
                      return (
                        <tr key={i} className={`border-b border-slate-100 ${isHeader ? "bg-amber-50" : isExample ? "bg-slate-50" : hasKR ? "bg-white" : "bg-slate-50/50"}`}>
                          <td className="px-3 py-1.5 text-slate-400">{row.rowNum}</td>
                          <td className={`px-3 py-1.5 max-w-[140px] truncate ${row.A_str ? "text-slate-800 font-semibold" : "text-slate-300"}`}>{row.A_str || "—"}</td>
                          <td className="px-3 py-1.5 text-slate-600">{row.B}</td>
                          <td className={`px-3 py-1.5 max-w-[160px] truncate ${hasKR ? "text-slate-800" : "text-slate-300"}`}>{row.C_str || "—"}</td>
                          <td className="px-3 py-1.5 text-slate-600">{row.D}</td>
                          <td className="px-3 py-1.5 text-slate-600">{row.E}</td>
                          <td className="px-3 py-1.5 text-slate-600">{row.F}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-4 py-2 text-xs text-slate-400">Showing the first 20 rows. Rows with column C filled = will be imported.</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 space-y-1">
          <p className="font-semibold">💡 Tips</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-600">
            <li>Klik <strong>🔍 Preview File</strong> first to check that columns A & C are read correctly before importing</li>
            <li>OKR status <strong>Draft</strong> will be replaced · completed ones <strong>Terkumpul</strong> aman</li>
            <li>Column C (Key Result) must be filled in every row</li>
          </ul>
        </div>
    </div>
  );
}
