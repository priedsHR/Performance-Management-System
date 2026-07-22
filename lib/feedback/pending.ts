import { prisma } from "@/lib/prisma";
import { computeAssignmentsFor, loadPeerExclusions, loadProfilesLite } from "@/lib/feedback/service";

// Active employees who still have at least one unsubmitted assessment for the
// given period, with how many are pending. Used by manual + automatic reminders.
export async function pendingRaters(periodId: string) {
  const profiles = (await loadProfilesLite()).filter((p) => p.active);
  const manualPeers = await prisma.feedbackManualPeer.findMany({ where: { OR: [{ periodId: null }, { periodId }] } });
  const manualByRater = new Map<string, string[]>();
  for (const mp of manualPeers) manualByRater.set(mp.raterId, [...(manualByRater.get(mp.raterId) ?? []), mp.rateeId]);
  const excluded = await loadPeerExclusions();

  // submitted responses grouped by rater+ratee
  const submitted = await prisma.feedbackResponse.findMany({
    where: { periodId, submitted: true },
    select: { raterId: true, rateeId: true },
  });
  const submittedPairs = new Set(submitted.map((r) => `${r.raterId}:${r.rateeId}`));

  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.userId) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const out: { id: string; name: string; email: string | null; pendingCount: number }[] = [];
  for (const p of profiles) {
    const assignments = computeAssignmentsFor(p.userId, profiles, manualByRater.get(p.userId) ?? [], excluded);
    const pending = assignments.filter((a) => !submittedPairs.has(`${p.userId}:${a.ratee.userId}`)).length;
    if (pending > 0) {
      const u = userById.get(p.userId);
      out.push({ id: p.userId, name: u?.name ?? "", email: u?.email ?? null, pendingCount: pending });
    }
  }
  return out;
}
