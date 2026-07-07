import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EmployeePeersManager from "./KaryawanPeersManager";

export default async function EmployeesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Employee Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage employee data, login accounts, 360 profiles, managers, and cross-department assignments.
        </p>
      </div>
      <EmployeePeersManager />
    </div>
  );
}
