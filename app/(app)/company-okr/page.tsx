import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompanyOKR from "./CompanyOKR";

export default async function CompanyOKRPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // All employees can view all departments' OKR (read-only).

  const quarters = await prisma.quarter.findMany({ orderBy: [{ year: "desc" }, { quarter: "desc" }] });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Company OKR</h1>
        <p className="text-sm text-slate-500 mt-0.5">All departments&apos; objectives, key results &amp; initiatives for the selected quarter.</p>
      </div>
      <CompanyOKR quarters={JSON.parse(JSON.stringify(quarters))} />
    </div>
  );
}
