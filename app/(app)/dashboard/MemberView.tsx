"use client";

import { useState } from "react";
import MemberProgress from "./MemberProgress";
import DivisionView from "./DivisionView";

type Props = {
  quarters: { id: string; name: string; year: number; quarter: number; isActive: boolean }[];
  initialQuarterId: string;
  leadId: string | null;
  divisionName: string | null;
};

type Tab = "divisi" | "progress";

export default function MemberView({ quarters, initialQuarterId, leadId, divisionName }: Props) {
  const [tab, setTab] = useState<Tab>(leadId ? "divisi" : "progress");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {leadId && (
          <button
            onClick={() => setTab("divisi")}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === "divisi"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            📊 {divisionName ?? "Divisi"}
          </button>
        )}
        <button
          onClick={() => setTab("progress")}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "progress"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🎯 Progress Saya
        </button>
      </div>

      {/* Tab content */}
      {tab === "divisi" && leadId && (
        <DivisionView
          quarters={quarters}
          leadId={leadId}
          divisionName={divisionName ?? "Divisi"}
        />
      )}

      {tab === "progress" && (
        <MemberProgress
          quarters={quarters}
          initialQuarterId={initialQuarterId}
        />
      )}
    </div>
  );
}
