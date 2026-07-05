import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NineBox from "./NineBox";

export default async function NineBoxPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const [periods, quarters] = await Promise.all([
    prisma.feedbackPeriod.findMany({ orderBy: [{ year: "desc" }, { half: "desc" }], select: { id: true, name: true, isActive: true } }),
    prisma.quarter.findMany({ orderBy: [{ year: "desc" }, { quarter: "desc" }], select: { id: true, name: true, isActive: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">9-Box Talent Matrix</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Potential = 360 score (Low &lt;3 · Moderate 3.00–3.50 · High 3.51–4.00) ·
          Performance = OKR achievement (Low ≤70% · Moderate 71–90% · High &gt;90%).
        </p>
      </div>
      <NineBox periods={JSON.parse(JSON.stringify(periods))} quarters={JSON.parse(JSON.stringify(quarters))} />
    </div>
  );
}
