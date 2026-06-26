"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import DashboardTabs from "./DashboardTabs";
import YearQuarterPicker from "@/components/YearQuarterPicker";

type Lead = { id: string; name: string; division: string | null };
type Quarter = { id: string; name: string; year: number; quarter: number; isActive: boolean };
type Summary = {
  leadId: string;
  name: string;
  division: string | null;
  achievement: number;
  memberCount: number;
  objectiveCount: number;
};

type Props = {
  leads: Lead[];
  quarters: Quarter[];
  allMembersByLead: Record<string, { id: string; name: string }[]>;
};

function achClass(v: number) {
  return v >= 100
    ? "bg-green-100 text-green-700"
    : v >= 70
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-600";
}
function barColor(v: number) {
  return v >= 100 ? "bg-green-500" : v >= 70 ? "bg-amber-400" : "bg-red-400";
}
function achEmoji(v: number) {
  return v >= 100 ? "🏆" : v >= 70 ? "🔥" : "📉";
}

export default function AdminOverview({ leads, quarters, allMembersByLead }: Props) {
  const activeQ = quarters.find((q) => q.isActive) ?? quarters[0];
  const [selectedQ, setSelectedQ] = useState(activeQ?.id ?? "");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedQ) return;
    setLoading(true);
    setSummaries([]);
    fetch(`/api/dashboard/summary?quarterId=${selectedQ}`)
      .then((r) => r.json())
      .then((d) => {
        setSummaries(Array.isArray(d.leads) ? d.leads : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedQ]);

  const filtered = leads.filter(
    (l) =>
      !search ||
      (l.division ?? l.name).toLowerCase().includes(search.toLowerCase())
  );

  const overallAch =
    summaries.length > 0
      ? summaries.reduce((s, x) => s + x.achievement, 0) / summaries.length
      : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">📊 Dashboard Semua Divisi</h1>
          <p className="text-xs text-slate-400 mt-1">Klik divisi untuk lihat detail OKR & individu</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white shadow-[0_2px_0_#e2e8f0]"
            placeholder="🔍 Cari divisi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <YearQuarterPicker quarters={quarters} value={selectedQ} onChange={(id) => { setSelectedQ(id); setExpandedId(null); }} />
        </div>
      </div>

      {/* Overall summary bar */}
      {!loading && overallAch !== null && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-slate-500 font-semibold">Rata-rata semua divisi:</span>
          <span className={`text-sm font-bold px-3 py-1 rounded-lg ${achClass(overallAch)}`}>
            {achEmoji(overallAch)} {overallAch.toFixed(1)}%
          </span>
          <div className="flex-1 min-w-[120px] h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full ${barColor(overallAch)}`}
              style={{ width: `${Math.min(overallAch, 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{leads.length} divisi</span>
        </div>
      )}

      {/* Division list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Divisi</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 hidden sm:block text-center">Progress</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-28 text-right">Pencapaian</span>
          <span className="w-6" />
        </div>

        {loading && (
          <div className="py-12 text-center text-slate-400 text-sm">
            <span className="animate-spin mr-2 text-lg inline-block">⏳</span> Memuat data...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">
            Tidak ada divisi yang cocok dengan pencarian.
          </div>
        )}

        {!loading && (
          <div className="divide-y divide-slate-100">
            {filtered.map((lead) => {
              const summary = summaries.find((s) => s.leadId === lead.id);
              const isExpanded = expandedId === lead.id;
              const a = summary?.achievement ?? null;

              return (
                <div key={lead.id}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                    className="w-full grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-5 py-4 hover:bg-amber-50/40 transition text-left group"
                  >
                    {/* Name + stats */}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm leading-snug">
                        🏢 {lead.division ?? lead.name}
                      </p>
                      {summary ? (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {summary.memberCount} anggota · {summary.objectiveCount} objective
                        </p>
                      ) : (
                        <p className="text-xs text-slate-300 mt-0.5">Memuat...</p>
                      )}
                    </div>

                    {/* Mini progress bar */}
                    <div className="w-24 hidden sm:block">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        {a !== null && (
                          <div
                            className={`h-1.5 rounded-full transition-all ${barColor(a)}`}
                            style={{ width: `${Math.min(a, 100)}%` }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Badge */}
                    <div className="w-28 text-right">
                      {a !== null ? (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${achClass(a)}`}>
                          {achEmoji(a)} {a.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="text-slate-300 group-hover:text-slate-500 transition w-6 flex-shrink-0 flex justify-center">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-6 bg-slate-50/30">
                      <DashboardTabs
                        title={lead.division ?? lead.name}
                        quarters={quarters}
                        members={allMembersByLead[lead.id] ?? []}
                        leadId={lead.id}
                        defaultQuarterId={selectedQ}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
