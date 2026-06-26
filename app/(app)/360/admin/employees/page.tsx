import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFeedbackBootstrap } from "@/lib/feedback/service";
import EmployeeManager360 from "./EmployeeManager360";

export default async function EmployeesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/360");
  await ensureFeedbackBootstrap();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Data Karyawan (360)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Setiap karyawan punya satu akun login. Departemen menentukan rekan (peer); atasan menentukan
          siapa menilai siapa. Mulai dari kosong — tambah satu per satu atau impor massal dari Excel.
        </p>
      </div>
      <EmployeeManager360 />
    </div>
  );
}
