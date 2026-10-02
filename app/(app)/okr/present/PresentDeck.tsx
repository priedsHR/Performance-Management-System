"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, ChevronLeft, ChevronRight, Target as TargetIcon, TrendingUp, Flag, Maximize, Pencil, Type, ImagePlus, Check, Trash2, Plus } from "lucide-react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Monthly = { year: number; month: number; actual: number };
type Initiative = { id: string; title: string; target: number; actual: number; unit: string; resultNote: string | null; pic: { name: string } | null; monthly: Monthly[] };
type KeyResult = { id: string; title: string; target: number; unit: string; weight: number; teamProgress: number; leadProgress: number | null; initiatives: Initiative[] };
type Objective = { id: string; title: string; weight: number; user: { name: string }; keyResults: KeyResult[] };

type Annotation = { id: string; slideKey: string; kind: "text" | "image"; content: string; x: number; y: number; w: number; h: number; fontSize: number; color: string; z: number };

function initAch(it: Initiative) { return it.target > 0 ? Math.min((it.actual / it.target) * 100, 100) : 0; }
function krActual(kr: KeyResult) { return kr.initiatives.length > 0 ? (kr.leadProgress ?? kr.teamProgress) : (kr.leadProgress ?? kr.teamProgress); }
function krAch(kr: KeyResult) {
  if (kr.initiatives.length > 0) return kr.initiatives.reduce((s, it) => s + initAch(it), 0) / kr.initiatives.length;
  return kr.target > 0 ? Math.min((krActual(kr) / kr.target) * 100, 100) : 0;
}
function objAch(obj: Objective) {
  if (obj.keyResults.length === 0) return 0;
  const tw = obj.keyResults.reduce((s, k) => s + k.weight, 0);
  if (tw <= 0) return obj.keyResults.reduce((s, k) => s + krAch(k), 0) / obj.keyResults.length;
  return obj.keyResults.reduce((s, k) => s + (krAch(k) * k.weight) / tw, 0);
}
const hex = (v: number) => (v >= 100 ? "#16a34a" : v >= 70 ? "#f59e0b" : "#ef4444");
const bg = (v: number) => (v >= 100 ? "bg-green-100 text-green-700" : v >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600");

function Donut({ pct, size = 150, stroke = 16 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hex(pct)} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .5s" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800" style={{ fontSize: size * 0.22, fontWeight: 800 }}>{pct.toFixed(0)}%</text>
    </svg>
  );
}

// Aggregate target/actual across an objective's KRs (best-effort; unit = most common)
function objTotals(obj: Objective) {
  const target = obj.keyResults.reduce((s, k) => s + k.target, 0);
  const actual = obj.keyResults.reduce((s, k) => s + krActual(k), 0);
  const unitCount: Record<string, number> = {};
  obj.keyResults.forEach((k) => { unitCount[k.unit] = (unitCount[k.unit] || 0) + 1; });
  const unit = Object.entries(unitCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return { target, actual, gap: Math.max(target - actual, 0), unit };
}

export default function PresentDeck({
  division, quarterId, curQuarter, nextQuarter, curMonths, curObjectives, nextObjectives,
}: {
  division: string;
  quarterId: string;
  curQuarter: { name: string; year: number; quarter: number };
  nextQuarter: { name: string } | null;
  curMonths: number[];
  curObjectives: Objective[];
  nextObjectives: Objective[];
}) {
  const overall = curObjectives.length
    ? curObjectives.reduce((s, o) => s + objAch(o) * (o.weight || 1), 0) / curObjectives.reduce((s, o) => s + (o.weight || 1), 0)
    : 0;

  // Custom blank slides the user adds (filled with annotations).
  const [customSlides, setCustomSlides] = useState<{ id: string; title: string }[]>([]);

  // Build slides: cover + one per current objective + plan + custom slides
  type Slide = { kind: "cover" } | { kind: "obj"; obj: Objective; idx: number } | { kind: "plan" } | { kind: "custom"; id: string; title: string };
  const slides: Slide[] = [
    { kind: "cover" },
    ...curObjectives.map((obj, idx) => ({ kind: "obj" as const, obj, idx })),
    { kind: "plan" as const },
    ...customSlides.map((c) => ({ kind: "custom" as const, id: c.id, title: c.title })),
  ];

  const [i, setI] = useState(0);
  const go = useCallback((d: number) => setI((v) => Math.min(Math.max(v + d, 0), slides.length - 1)), [slides.length]);

  // ── Annotations (text boxes / images) ──────────────────────────────────────
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/slide-annotations?division=${encodeURIComponent(division)}&quarterId=${quarterId}`)
      .then((r) => (r.ok ? r.json() : { annotations: [], canEdit: false }))
      .then((d) => { setAnnotations(d.annotations || []); setCanEdit(!!d.canEdit); })
      .catch(() => {});
    fetch(`/api/presentation-slides?division=${encodeURIComponent(division)}&quarterId=${quarterId}`)
      .then((r) => (r.ok ? r.json() : { slides: [] }))
      .then((d) => setCustomSlides(d.slides || []))
      .catch(() => {});
  }, [division, quarterId]);

  const slideKeyOf = (s: Slide) =>
    s.kind === "cover" ? "cover" : s.kind === "plan" ? "plan" : s.kind === "custom" ? `custom:${s.id}` : `obj:${s.obj.id}`;

  async function addSlide() {
    const res = await fetch("/api/presentation-slides", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division, quarterId, title: "New slide" }),
    });
    if (res.ok) { const s = await res.json(); setCustomSlides((p) => [...p, { id: s.id, title: s.title }]); setTimeout(() => setI(slides.length), 0); }
  }
  async function updateSlideTitle(id: string, title: string) {
    setCustomSlides((p) => p.map((s) => (s.id === id ? { ...s, title } : s)));
    await fetch(`/api/presentation-slides/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
  }
  async function deleteSlide(id: string) {
    if (!confirm("Delete this slide and everything on it?")) return;
    setCustomSlides((p) => p.filter((s) => s.id !== id));
    setAnnotations((p) => p.filter((a) => a.slideKey !== `custom:${id}`));
    setI((v) => Math.max(0, v - 1));
    await fetch(`/api/presentation-slides/${id}`, { method: "DELETE" });
  }
  const curKey = slideKeyOf(slides[i]);

  async function addAnnotation(kind: "text" | "image", content: string) {
    const res = await fetch("/api/slide-annotations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division, quarterId, slideKey: curKey, kind, content,
        x: 34, y: 38, w: kind === "image" ? 32 : 28, h: kind === "image" ? 26 : 12 }),
    });
    if (res.ok) { const a = await res.json(); setAnnotations((p) => [...p, a]); setSelId(a.id); }
    else { const d = await res.json().catch(() => ({})); alert(d.error || "Could not add."); }
  }
  function patchAnnotationLocal(id: string, data: Partial<Annotation>) {
    setAnnotations((p) => p.map((a) => (a.id === id ? { ...a, ...data } : a)));
  }
  async function saveAnnotation(id: string, data: Partial<Annotation>) {
    await fetch(`/api/slide-annotations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  }
  async function removeAnnotation(id: string) {
    setAnnotations((p) => p.filter((a) => a.id !== id)); setSelId(null);
    await fetch(`/api/slide-annotations/${id}`, { method: "DELETE" });
  }

  // Downscale an image to keep the stored data URL small, then add it.
  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200; let { width, height } = img;
        if (width > max) { height = (height * max) / width; width = max; }
        const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        addAnnotation("image", dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Drag / resize using pointer deltas converted to % of the stage.
  function startDrag(e: React.PointerEvent, ann: Annotation, mode: "move" | "resize") {
    if (!editMode) return;
    e.preventDefault(); e.stopPropagation(); setSelId(ann.id);
    const rect = stageRef.current!.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const o = { x: ann.x, y: ann.y, w: ann.w, h: ann.h };
    function onMove(ev: PointerEvent) {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      if (mode === "move") patchAnnotationLocal(ann.id, { x: Math.max(0, Math.min(95, o.x + dx)), y: Math.max(0, Math.min(95, o.y + dy)) });
      else patchAnnotationLocal(ann.id, { w: Math.max(5, Math.min(100, o.w + dx)), h: Math.max(4, Math.min(100, o.h + dy)) });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      setAnnotations((cur) => { const a = cur.find((x) => x.id === ann.id); if (a) saveAnnotation(a.id, { x: a.x, y: a.y, w: a.w, h: a.h }); return cur; });
    }
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  }

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const [isFull, setIsFull] = useState(false);
  function toggleFull() {
    const el = stageRef.current?.parentElement;
    if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }
  useEffect(() => {
    const h = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editMode) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go, editMode]);

  const nextFocus = nextObjectives.slice(0, 4).map((o) => o.title);

  function CoverSlide() {
    return (
      <div className="h-full flex flex-col justify-center items-center text-center gap-5 px-10">
        <p className="text-sm font-semibold tracking-widest text-[#097eb9] uppercase">OKR Review &amp; Planning · {curQuarter.name}</p>
        <h1 className="text-4xl font-extrabold text-slate-900">{division}</h1>
        <Donut pct={overall} size={190} stroke={20} />
        <p className="text-slate-500 text-sm">Overall achievement across {curObjectives.length} objective{curObjectives.length === 1 ? "" : "s"}</p>
      </div>
    );
  }

  function ObjSlide({ obj, idx }: { obj: Objective; idx: number }) {
    const a = objAch(obj);
    const t = objTotals(obj);
    const notes = obj.keyResults.flatMap((k) => k.initiatives).filter((it) => (it.resultNote || "").trim()).slice(0, 4);
    const fillNotes = notes.length < 4
      ? obj.keyResults.flatMap((k) => k.initiatives).filter((it) => !(it.resultNote || "").trim()).slice(0, 4 - notes.length).map((it) => ({ ...it, resultNote: `${it.title} — ${initAch(it).toFixed(0)}% of target` }))
      : [];
    const highlights = [...notes, ...fillNotes];
    return (
      <div className="h-full flex flex-col px-8 py-6">
        <div className="mb-3">
          <h1 className="text-2xl font-extrabold text-slate-900">Evaluation · {curQuarter.name}</h1>
          <p className="text-slate-500 text-sm font-medium border-b-2 border-[#49C5E9] inline-block pb-0.5 mt-0.5">OBJECTIVE {idx + 1}: {obj.title}</p>
        </div>

        <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">
          {/* Left: overall + KR bars */}
          <div className="col-span-3 flex flex-col gap-3 min-h-0">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
              <Donut pct={a} size={120} stroke={14} />
              <div className="grid grid-cols-3 gap-2 flex-1">
                <KpiTile icon={<TargetIcon size={14} />} label="Target" value={t.target} unit={t.unit} color="text-[#097eb9]" />
                <KpiTile icon={<TrendingUp size={14} />} label="Actual" value={t.actual} unit={t.unit} color="text-green-600" />
                <KpiTile icon={<Flag size={14} />} label="Gap" value={t.gap} unit={t.unit} color="text-orange-500" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1 min-h-0 overflow-auto">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Achievement by Key Result</p>
              <div className="space-y-2.5">
                {obj.keyResults.map((kr, ki) => {
                  const kp = krAch(kr);
                  return (
                    <div key={kr.id} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 w-8 flex-shrink-0">{idx + 1}.{ki + 1}</span>
                      <span className="text-xs text-slate-600 flex-1 truncate" title={kr.title}>{kr.title}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums w-16 text-right flex-shrink-0">{krActual(kr)}/{kr.target}</span>
                      <div className="w-28 h-3.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-3.5 rounded-full" style={{ width: `${Math.min(kp, 100)}%`, background: hex(kp) }} />
                      </div>
                      <span className="text-[11px] font-bold w-10 text-right flex-shrink-0" style={{ color: hex(kp) }}>{kp.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: highlights */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-4 flex flex-col min-h-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Key Highlights &amp; Evaluation</p>
            <div className="space-y-2.5 overflow-auto flex-1">
              {highlights.length === 0 ? (
                <p className="text-xs text-slate-300 italic">No evaluation notes yet.</p>
              ) : highlights.map((it) => (
                <div key={it.id} className="flex gap-2 items-start">
                  <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: hex(initAch(it)) }} />
                  <p className="text-xs text-slate-600 leading-snug">
                    <span className="font-semibold text-slate-700">{it.pic?.name ?? it.title.slice(0, 20)}:</span> {it.resultNote}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: next-quarter focus */}
        {nextFocus.length > 0 && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs font-bold text-[#097eb9] uppercase tracking-wide flex-shrink-0">{nextQuarter?.name} Focus</span>
            <div className="flex gap-2 flex-wrap">
              {nextFocus.map((f, k) => <span key={k} className="text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-600">{f}</span>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  function PlanSlide() {
    return (
      <div className="h-full flex flex-col px-8 py-6">
        <div className="mb-3">
          <h1 className="text-2xl font-extrabold text-slate-900">{nextQuarter ? `${nextQuarter.name} — Plan` : "Next Quarter — Plan"}</h1>
          <p className="text-slate-500 text-sm">Objectives, key results &amp; initiatives for next quarter.</p>
        </div>
        <div className="flex-1 min-h-0 overflow-auto grid md:grid-cols-2 gap-3">
          {(!nextQuarter || nextObjectives.length === 0) ? (
            <div className="col-span-2 bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 text-sm">
              {nextQuarter ? `No OKR drafted yet for ${nextQuarter.name}.` : "No next quarter has been created yet."}
            </div>
          ) : nextObjectives.map((obj, oi) => (
            <div key={obj.id} className="bg-white border border-slate-200 rounded-xl p-4 break-inside-avoid">
              <p className="font-bold text-slate-800 text-sm mb-2"><span className="text-[#097eb9]">Objective {oi + 1}</span> · {obj.title}</p>
              <div className="space-y-2">
                {obj.keyResults.map((kr, ki) => (
                  <div key={kr.id}>
                    <p className="text-xs font-semibold text-slate-700">KR {oi + 1}.{ki + 1}: {kr.title} <span className="text-slate-400 font-normal">· target {kr.target} {kr.unit}</span></p>
                    {kr.initiatives.length > 0 && (
                      <ul className="pl-4 mt-0.5 space-y-0.5">
                        {kr.initiatives.map((it) => (
                          <li key={it.id} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-[#49C5E9] flex-shrink-0" />{it.title}<span className="text-slate-400">· {it.pic?.name ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function CustomSlide({ id, title }: { id: string; title: string }) {
    return (
      <div className="h-full flex flex-col px-8 py-6">
        {editMode ? (
          <input
            value={title}
            onChange={(e) => setCustomSlides((p) => p.map((s) => (s.id === id ? { ...s, title: e.target.value } : s)))}
            onBlur={(e) => updateSlideTitle(id, e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-2xl font-extrabold text-slate-900 bg-transparent border-b border-dashed border-slate-200 focus:border-amber-400 focus:outline-none"
          />
        ) : (
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        )}
        {editMode && (
          <p className="text-xs text-slate-300 mt-auto mb-auto text-center">Blank slide — use <b>＋ Text</b> and <b>＋ Image</b> to add content here.</p>
        )}
      </div>
    );
  }

  function renderSlide(s: Slide) {
    if (s.kind === "cover") return <CoverSlide />;
    if (s.kind === "plan") return <PlanSlide />;
    if (s.kind === "custom") return <CustomSlide id={s.id} title={s.title} />;
    return <ObjSlide obj={s.obj} idx={s.idx} />;
  }

  const curAnns = annotations.filter((a) => a.slideKey === curKey);

  return (
    <div className="space-y-3">
      {/* Controls — hidden in print */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <Link href="/company-okr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {editMode && (
            <>
              <button onClick={() => addAnnotation("text", "Double-click to edit")} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Type size={14} /> Text</button>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ImagePlus size={14} /> Image</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              <button onClick={addSlide} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Plus size={14} /> Slide</button>
              {slides[i].kind === "custom" && (
                <button onClick={() => deleteSlide((slides[i] as { id: string }).id)} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"><Trash2 size={14} /> Slide</button>
              )}
            </>
          )}
          {canEdit && (
            <button onClick={() => { setEditMode((v) => !v); setSelId(null); }} className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg ${editMode ? "bg-green-600 text-white hover:bg-green-700" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {editMode ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Edit</>}
            </button>
          )}
          <button onClick={() => go(-1)} disabled={i === 0} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-sm text-slate-500 tabular-nums w-16 text-center">{i + 1} / {slides.length}</span>
          <button onClick={() => go(1)} disabled={i === slides.length - 1} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={16} /></button>
          <button onClick={toggleFull} title="Full screen" className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Maximize size={16} /></button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-[#097eb9] text-white hover:bg-[#0b6fa3]"><Printer size={15} /> PDF</button>
        </div>
      </div>

      {/* On-screen: current slide only, 16:9. This wrapper is the fullscreen target. */}
      <div className={`print:hidden ${isFull ? "flex items-center justify-center bg-slate-900 w-screen h-screen" : ""}`}>
        <div
          ref={stageRef}
          onPointerDown={() => editMode && setSelId(null)}
          className={`relative w-full max-w-5xl mx-auto aspect-[16/9] bg-gradient-to-br from-slate-50 to-cyan-50/40 border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${isFull ? "max-w-none !rounded-none" : ""}`}
          style={isFull ? { width: "min(100vw, calc(100vh * 16 / 9))", height: "min(100vh, calc(100vw * 9 / 16))" } : undefined}
        >
          {renderSlide(slides[i])}
          {/* Annotation overlay */}
          {curAnns.map((a) => (
            <AnnotationBox
              key={a.id} ann={a} editMode={editMode} selected={selId === a.id}
              onSelect={() => setSelId(a.id)}
              onStartDrag={(e, mode) => startDrag(e, a, mode)}
              onChangeText={(v) => patchAnnotationLocal(a.id, { content: v })}
              onSaveText={(v) => saveAnnotation(a.id, { content: v })}
              onRemove={() => removeAnnotation(a.id)}
            />
          ))}

          {/* In-slide nav arrows when fullscreen */}
          {isFull && (
            <>
              <button onClick={() => go(-1)} disabled={i === 0} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow disabled:opacity-20"><ChevronLeft size={22} /></button>
              <button onClick={() => go(1)} disabled={i === slides.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow disabled:opacity-20"><ChevronRight size={22} /></button>
              <span className="absolute bottom-3 right-4 text-xs text-slate-500 bg-white/80 rounded px-2 py-0.5">{i + 1} / {slides.length}</span>
            </>
          )}
        </div>
      </div>
      {editMode && <p className="text-xs text-slate-400 print:hidden">Editing — drag to move, drag the corner to resize, double-click text to edit. Changes save automatically and show for everyone.</p>}

      {/* Print: every slide, each on its own page (with its annotations) */}
      <div className="hidden print:block">
        {slides.map((s, idx) => {
          const key = slideKeyOf(s);
          return (
            <div key={idx} className="relative w-full aspect-[16/9] bg-white border border-slate-200 rounded-2xl overflow-hidden break-after-page">
              {renderSlide(s)}
              {annotations.filter((a) => a.slideKey === key).map((a) => (
                <AnnotationBox key={a.id} ann={a} editMode={false} selected={false} onSelect={() => {}} onStartDrag={() => {}} onChangeText={() => {}} onSaveText={() => {}} onRemove={() => {}} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnnotationBox({ ann, editMode, selected, onSelect, onStartDrag, onChangeText, onSaveText, onRemove }: {
  ann: Annotation; editMode: boolean; selected: boolean;
  onSelect: () => void;
  onStartDrag: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onChangeText: (v: string) => void;
  onSaveText: (v: string) => void;
  onRemove: () => void;
}) {
  const [editingText, setEditingText] = useState(false);
  const style: React.CSSProperties = { position: "absolute", left: `${ann.x}%`, top: `${ann.y}%`, width: `${ann.w}%`, height: ann.kind === "image" ? `${ann.h}%` : undefined, zIndex: 10 + ann.z };
  return (
    <div
      style={style}
      onPointerDown={(e) => { if (editMode && !editingText) onStartDrag(e, "move"); }}
      onClick={(e) => { e.stopPropagation(); if (editMode) onSelect(); }}
      className={`${editMode ? "cursor-move" : ""} ${selected ? "outline outline-2 outline-[#097eb9]" : ""}`}
    >
      {ann.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ann.content} alt="" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
      ) : editingText ? (
        <textarea
          autoFocus defaultValue={ann.content}
          onBlur={(e) => { setEditingText(false); onChangeText(e.target.value); onSaveText(e.target.value); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ fontSize: ann.fontSize, color: ann.color }}
          className="w-full h-full min-h-[1.5em] resize-none bg-white/80 border border-[#097eb9] rounded p-1 focus:outline-none leading-snug"
        />
      ) : (
        <div
          onDoubleClick={() => editMode && setEditingText(true)}
          style={{ fontSize: ann.fontSize, color: ann.color }}
          className="w-full h-full whitespace-pre-wrap leading-snug font-semibold"
        >
          {ann.content}
        </div>
      )}

      {editMode && selected && !editingText && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow"><Trash2 size={11} /></button>
          <div onPointerDown={(e) => onStartDrag(e, "resize")} className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#097eb9] rounded-sm cursor-se-resize" />
        </>
      )}
    </div>
  );
}

function KpiTile({ icon, label, value, unit, color }: { icon: React.ReactNode; label: string; value: number; unit: string; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <div className={`flex items-center justify-center gap-1 ${color}`}>{icon}<span className="text-[10px] font-bold uppercase tracking-wide">{label}</span></div>
      <p className="text-lg font-extrabold text-slate-800 leading-tight mt-0.5">{Number.isInteger(value) ? value : value.toFixed(1)}</p>
      <p className="text-[9px] text-slate-400">{unit}</p>
    </div>
  );
}
