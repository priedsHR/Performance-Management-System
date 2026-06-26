import { prisma } from "@/lib/prisma";
import { bandFor, type FeedbackSettings, type RelationType } from "@/lib/feedback/service";
import { CATEGORY_LABEL, type Category } from "@/lib/feedback/library";

const CAT_ORDER: Category[] = ["CORE", "LEADERSHIP", "JOB_FAMILY", "TECHNICAL"];

function mean(a: number[]): number | null {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}

export interface CompScore {
  competencyId: string;
  code: string;
  name: string;
  category: Category;
  groups: Record<RelationType, number | null>;
  weighted: number | null;
}

export interface RateeReport {
  hasData: boolean;
  targetLevel: number | null;
  overall: number | null;
  overallBand: { key: string; label: string; color: string };
  categories: { category: Category; label: string; score: number | null; comps: CompScore[] }[];
  responseCount: number;
}

// Aggregate one ratee's submitted responses for a period into a weighted report.
export async function scoreRatee(
  rateeUserId: string,
  periodId: string,
  settings: FeedbackSettings
): Promise<RateeReport> {
  const profile = await prisma.feedbackProfile.findUnique({
    where: { userId: rateeUserId },
    include: {
      competencies: { include: { competency: true } },
    },
  });
  const targetLevel = profile?.targetLevel ?? null;

  const responses = await prisma.feedbackResponse.findMany({
    where: { rateeId: rateeUserId, periodId, submitted: true },
    include: { competency: true },
  });

  const W: Record<string, number> = {
    SUPERORDINATE: settings.weightSuper,
    PEER: settings.weightPeer,
    SUBORDINATE: settings.weightSub,
  };

  // competencies this person is assessed on
  const comps = (profile?.competencies ?? []).map((pc) => pc.competency);

  const byComp = new Map<string, CompScore>();
  for (const c of comps) {
    byComp.set(c.id, {
      competencyId: c.id,
      code: c.code,
      name: c.name,
      category: c.category as Category,
      groups: { SELF: null, PEER: null, SUPERORDINATE: null, SUBORDINATE: null },
      weighted: null,
    });
  }

  // collect raw scores per competency per relation group
  const raw = new Map<string, Record<RelationType, number[]>>();
  for (const r of responses) {
    if (!byComp.has(r.competencyId)) continue; // competency no longer assigned
    let g = raw.get(r.competencyId);
    if (!g) {
      g = { SELF: [], PEER: [], SUPERORDINATE: [], SUBORDINATE: [] };
      raw.set(r.competencyId, g);
    }
    g[r.relation as RelationType].push(r.score);
  }

  for (const [cid, cs] of byComp) {
    const g = raw.get(cid);
    if (!g) continue;
    (["SELF", "PEER", "SUPERORDINATE", "SUBORDINATE"] as RelationType[]).forEach((k) => {
      cs.groups[k] = mean(g[k]);
    });
    let num = 0, den = 0;
    (["SUPERORDINATE", "PEER", "SUBORDINATE"] as RelationType[]).forEach((k) => {
      const v = cs.groups[k];
      if (v != null) {
        num += v * W[k];
        den += W[k];
      }
    });
    cs.weighted = den ? num / den : null;
  }

  const categories = CAT_ORDER.map((cat) => {
    const list = [...byComp.values()].filter((c) => c.category === cat);
    const score = mean(list.map((c) => c.weighted).filter((v): v is number => v != null));
    return { category: cat, label: CATEGORY_LABEL[cat], score, comps: list };
  }).filter((c) => c.comps.length > 0);

  const overall = mean(categories.map((c) => c.score).filter((v): v is number => v != null));

  return {
    hasData: responses.length > 0,
    targetLevel,
    overall,
    overallBand: bandFor(overall, settings.bands),
    categories,
    responseCount: responses.length,
  };
}
