import { prisma } from "@/lib/prisma";
import {
  COMPETENCY_LIBRARY,
  DEFAULT_BANDS,
  DEFAULT_LEVEL_TARGETS,
  DEFAULT_WEIGHTS,
  type Band,
} from "@/lib/feedback/library";

export interface FeedbackSettings {
  weightSuper: number;
  weightPeer: number;
  weightSub: number;
  bands: Band[];
  levelTargets: Record<string, number>;
}

// Lazily seed competencies + settings on first use (build runs prisma db push,
// not the seed script, so a non-technical admin never needs the command line).
export async function ensureFeedbackBootstrap(): Promise<void> {
  const settingCount = await prisma.feedbackSetting.count();
  if (settingCount === 0) {
    await prisma.feedbackSetting.create({
      data: {
        id: "singleton",
        weightSuper: DEFAULT_WEIGHTS.super,
        weightPeer: DEFAULT_WEIGHTS.peer,
        weightSub: DEFAULT_WEIGHTS.sub,
        bands: DEFAULT_BANDS,
        levelTargets: DEFAULT_LEVEL_TARGETS,
      },
    });
  }
  const compCount = await prisma.competency.count();
  if (compCount === 0) {
    await prisma.competency.createMany({
      data: COMPETENCY_LIBRARY.map((c, i) => ({
        code: c.code,
        name: c.name,
        category: c.category,
        department: c.department,
        definition: c.definition,
        l1: c.levels[0],
        l2: c.levels[1],
        l3: c.levels[2],
        l4: c.levels[3],
        sortOrder: i,
      })),
      skipDuplicates: true,
    });
  } else {
    // Resync library wording (e.g. after the library was translated to English).
    // Cheap sentinel check: if one known competency's definition differs from the
    // library, refresh definition/levels for every library-coded competency.
    const sentinelSeed = COMPETENCY_LIBRARY[0];
    const sentinel = await prisma.competency.findFirst({ where: { code: sentinelSeed.code } });
    if (sentinel && sentinel.definition !== sentinelSeed.definition) {
      for (const c of COMPETENCY_LIBRARY) {
        await prisma.competency.updateMany({
          where: { code: c.code },
          data: {
            name: c.name,
            definition: c.definition,
            l1: c.levels[0],
            l2: c.levels[1],
            l3: c.levels[2],
            l4: c.levels[3],
          },
        });
      }
    }
  }
}

export async function getFeedbackSettings(): Promise<FeedbackSettings> {
  await ensureFeedbackBootstrap();
  const s = await prisma.feedbackSetting.findUnique({ where: { id: "singleton" } });
  if (!s) {
    return {
      weightSuper: DEFAULT_WEIGHTS.super,
      weightPeer: DEFAULT_WEIGHTS.peer,
      weightSub: DEFAULT_WEIGHTS.sub,
      bands: DEFAULT_BANDS,
      levelTargets: DEFAULT_LEVEL_TARGETS,
    };
  }
  return {
    weightSuper: s.weightSuper,
    weightPeer: s.weightPeer,
    weightSub: s.weightSub,
    bands: (s.bands as unknown as Band[]) ?? DEFAULT_BANDS,
    levelTargets: (s.levelTargets as unknown as Record<string, number>) ?? DEFAULT_LEVEL_TARGETS,
  };
}

export function bandFor(score: number | null, bands: Band[]) {
  if (score == null) return { key: "nd", label: "No data yet", color: "slate" };
  for (const b of bands) {
    if (score < b.max) return b;
  }
  return bands[bands.length - 1];
}

// The automatic rule that decides which competencies attach to a profile.
// Returns competency IDs. Technical comps that are department-specific are NOT
// auto-attached (admin picks them); AIF-style all-department technical IS attached.
export function resolveAutoCompetencyIds(
  profile: { department: string | null; isManager: boolean },
  allComps: { id: string; category: string; department: string | null; active: boolean }[]
): string[] {
  const ids: string[] = [];
  for (const c of allComps) {
    if (!c.active) continue;
    if (c.category === "CORE") ids.push(c.id);
    else if (c.category === "LEADERSHIP" && profile.isManager) ids.push(c.id);
    else if (c.category === "JOB_FAMILY" && c.department && c.department === profile.department) ids.push(c.id);
    else if (c.category === "TECHNICAL" && c.department == null) ids.push(c.id); // e.g. AI Fluency for all
  }
  return ids;
}

export type RelationType = "SELF" | "PEER" | "SUPERORDINATE" | "SUBORDINATE";

export interface ProfileLite {
  userId: string;
  name: string;
  department: string | null;
  position: string | null;
  targetLevel: number | null;
  managerId: string | null;
  active: boolean;
  competencyIds: string[];
}

// Build the list of people a given rater must assess, with the rater's group
// relative to each ratee (already inverted, ready for scoring).
// manualPeerRateeIds: additional user IDs this rater should assess as PEER (cross-dept assignments).
export function computeAssignmentsFor(
  raterUserId: string,
  profiles: ProfileLite[],
  manualPeerRateeIds: string[] = []
): { ratee: ProfileLite; relation: RelationType }[] {
  const me = profiles.find((p) => p.userId === raterUserId);
  if (!me || !me.active) return [];
  const out: { ratee: ProfileLite; relation: RelationType }[] = [];
  for (const p of profiles) {
    if (!p.active) continue;
    let rel: RelationType | null = null;
    if (p.userId === raterUserId) rel = "SELF";
    else if (me.managerId && me.managerId === p.userId) rel = "SUBORDINATE";
    else if (p.managerId && p.managerId === raterUserId) rel = "SUPERORDINATE";
    else if (me.department && p.department && me.department === p.department) rel = "PEER";
    else if (manualPeerRateeIds.includes(p.userId)) rel = "PEER";
    if (rel) out.push({ ratee: p, relation: rel });
  }
  const rank: Record<RelationType, number> = { SELF: 0, SUBORDINATE: 1, PEER: 2, SUPERORDINATE: 3 };
  out.sort((a, b) => rank[a.relation] - rank[b.relation] || a.ratee.name.localeCompare(b.ratee.name));
  return out;
}

// Load all active profiles with their resolved competency IDs.
export async function loadProfilesLite(): Promise<ProfileLite[]> {
  const profiles = await prisma.feedbackProfile.findMany({
    include: {
      user: { select: { id: true, name: true } },
      competencies: { select: { competencyId: true } },
    },
  });
  return profiles.map((p) => ({
    userId: p.userId,
    name: p.user.name,
    department: p.department,
    position: p.position,
    targetLevel: p.targetLevel,
    managerId: p.managerId,
    active: p.active,
    competencyIds: p.competencies.map((c) => c.competencyId),
  }));
}

export async function getActivePeriod() {
  return prisma.feedbackPeriod.findFirst({ where: { isActive: true } });
}
