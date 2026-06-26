import { auth } from "@/auth";
import ReportView from "./ReportView";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; periodId?: string }>;
}) {
  const session = await auth();
  const { userId, periodId } = await searchParams;
  const targetUserId = userId || session!.user.id;
  const isOwn = targetUserId === session!.user.id;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">{isOwn ? "Rapor 360 Saya" : "Rapor 360"}</h1>
      <ReportView userId={targetUserId} periodId={periodId ?? null} isOwn={isOwn} />
    </div>
  );
}
