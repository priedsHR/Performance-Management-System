"use client";

import { useState } from "react";
import DivisionView from "./DivisionView";
import IndividualView from "./IndividualView";

type Props = {
  title: string;
  quarters: { id: string; name: string; year: number; quarter: number; isActive: boolean }[];
  members: { id: string; name: string }[];
  leadId: string;
  defaultQuarterId?: string;
};

export default function DashboardTabs({ title, quarters, members, leadId, defaultQuarterId }: Props) {
  const [tab, setTab] = useState<"division" | "individual">("division");

  return (
    <div>
      {/* Division label */}
      <h2 className="text-base font-bold text-slate-700 mb-4">🏢 {title}</h2>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setTab("division")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-100 ${
            tab === "division"
              ? "bg-white text-slate-900 shadow-sm shadow-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📊 Division
        </button>
        <button
          onClick={() => setTab("individual")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-100 ${
            tab === "individual"
              ? "bg-white text-slate-900 shadow-sm shadow-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          👤 Individu
        </button>
      </div>

      {/* Content */}
      {tab === "division" ? (
        <DivisionView quarters={quarters} leadId={leadId} divisionName={title} defaultQuarterId={defaultQuarterId} />
      ) : (
        <IndividualView quarters={quarters} members={members} leadId={leadId} defaultQuarterId={defaultQuarterId} />
      )}
    </div>
  );
}
