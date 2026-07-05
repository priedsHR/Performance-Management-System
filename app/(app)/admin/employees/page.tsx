import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EmployeePeersManager from "./KaryawanPeersManager";

export default async function EmployeesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">🧑‍💼 Manajemen Employee</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Kelola data employee, akun login, profil 360, atasan, dan assessment lintas departemen.
        </p>
      </div>
      <EmployeePeersManager />
    </div>
  );
}
