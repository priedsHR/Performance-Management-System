"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { groupByYear } from "@/lib/quarter-group";

type Quarter = { id: string; name: string; year: number; quarter: number; isActive: boolean };

type Props = {
  quarters: Quarter[];
  value: string;
  onChange: (quarterId: string) => void;
};

export default function YearQuarterPicker({ quarters, value, onChange }: Props) {
  const grouped = groupByYear(quarters);
  const years = grouped.map((g) => g.year);

  const selectedQ = quarters.find((q) => q.id === value);
  const [selectedYear, setSelectedYear] = useState<number>(
    selectedQ?.year ?? years[0] ?? new Date().getFullYear()
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync year if value changes externally
  useEffect(() => {
    const q = quarters.find((q) => q.id === value);
    if (q && q.year !== selectedYear) setSelectedYear(q.year);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredYears = years.filter((y) => String(y).includes(search));
  const yearQuarters = grouped.find((g) => g.year === selectedYear)?.quarters ?? [];

  const qBtn = (active: boolean, isCurrentActive: boolean) =>
    `px-3 py-1 rounded-lg text-xs font-bold transition-all duration-75 ` +
    (active
      ? "bg-amber-400 text-white shadow-[0_2px_0_#097eb9]"
      : isCurrentActive
      ? "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 shadow-[0_2px_0_#fde68a] hover:shadow-[0_1px_0_#fde68a] hover:translate-y-px"
      : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 shadow-[0_2px_0_#e2e8f0] hover:shadow-[0_1px_0_#e2e8f0] hover:translate-y-px");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Year searchable dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => { setOpen(!open); setSearch(""); }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-700 text-white shadow-[0_2px_0_#1e293b] hover:shadow-[0_1px_0_#1e293b] hover:translate-y-px transition-all duration-75"
        >
          {selectedYear}
          <ChevronDown size={11} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[90px]">
            {years.length > 4 && (
              <div className="p-1.5 border-b border-slate-100">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto py-1">
              {filteredYears.length > 0 ? filteredYears.map((y) => (
                <button
                  key={y}
                  onClick={() => { setSelectedYear(y); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${
                    y === selectedYear
                      ? "bg-amber-50 text-amber-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {y}
                </button>
              )) : (
                <p className="px-3 py-2 text-xs text-slate-400">Not found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quarter pills */}
      {yearQuarters.map((q) => (
        <button
          key={q.id}
          onClick={() => onChange(q.id)}
          className={qBtn(q.id === value, q.isActive)}
        >
          Q{q.quarter}{q.isActive ? " ✅" : ""}
        </button>
      ))}
    </div>
  );
}
