"use client";

import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";

type KR = {
  id: string;
  title: string;
  target: number;
  unit: string;
  teamProgress: number;
  leadProgress: number | null;
};

export default function LeadOverride({ kr }: { kr: KR }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(kr.leadProgress ?? kr.teamProgress);
  const [current, setCurrent] = useState<number | null>(kr.leadProgress);

  async function save() {
    const res = await fetch(`/api/key-results/${kr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadProgress: value }),
    });
    if (res.ok) {
      setCurrent(value);
      setEditing(false);
    }
  }

  async function clear() {
    await fetch(`/api/key-results/${kr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadProgress: null }),
    });
    setCurrent(null);
    setValue(kr.teamProgress);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 mt-1.5 text-xs">
      <span className="text-gray-400 truncate flex-1">{kr.title}</span>
      <span className="text-gray-400">
        {kr.teamProgress}/{kr.target} {kr.unit}
      </span>
      {current !== null && (
        <span className="text-blue-500 font-medium">→ Lead: {current}</span>
      )}
      {!editing ? (
        <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-yellow-500 transition">
          <Edit2 size={12} />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-16 border border-yellow-400 rounded px-1 py-0.5 text-xs focus:outline-none"
            value={value}
            onChange={e => setValue(Number(e.target.value))}
            min={0}
          />
          <button onClick={save} className="text-green-500 hover:text-green-700"><Check size={12} /></button>
          <button onClick={clear} className="text-red-400 hover:text-red-600"><X size={12} /></button>
        </div>
      )}
    </div>
  );
}
