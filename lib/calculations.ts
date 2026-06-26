export type KR = {
  id: string;
  title: string;
  target: number;
  unit: string;
  weight: number;
  teamProgress: number;
  leadProgress: number | null;
};

export type ObjWithKRs = {
  id: string;
  title: string;
  weight: number;
  keyResults: KR[];
};

type KRAssignment = {
  keyResultId: string;
  weight: number;
  progress: number;
  target?: number | null; // individual target override
};

type Assignment = {
  weight: number;
  objectiveId: string;
  objective?: ObjWithKRs;
  krAssignments?: KRAssignment[];
};

export function calcKRAchievement(kr: KR): number {
  const progress = kr.teamProgress + (kr.leadProgress ?? 0);
  if (kr.target === 0) return 0;
  return Math.min((progress / kr.target) * 100, 100);
}

export function calcObjectiveAchievement(obj: ObjWithKRs): number {
  if (obj.keyResults.length === 0) return 0;
  const totalWeight = obj.keyResults.reduce((s: number, kr: KR) => s + kr.weight, 0);
  if (totalWeight === 0) return 0;
  return obj.keyResults.reduce(
    (s: number, kr: KR) => s + (calcKRAchievement(kr) * kr.weight) / totalWeight,
    0
  );
}

// Aggregate teamProgress per KR from all member KRAssignments.
// For % unit: average across members. For others: sum contributions.
export function aggregateKRProgress(
  objectives: ObjWithKRs[],
  allKRAssignments: KRAssignment[]
): ObjWithKRs[] {
  const progressListMap = new Map<string, number[]>();
  for (const kra of allKRAssignments) {
    const list = progressListMap.get(kra.keyResultId) ?? [];
    list.push(kra.progress);
    progressListMap.set(kra.keyResultId, list);
  }

  return objectives.map((obj) => ({
    ...obj,
    keyResults: obj.keyResults.map((kr) => {
      const list = progressListMap.get(kr.id);
      if (!list || list.length === 0) return kr;
      const teamProgress =
        kr.unit === "%"
          ? list.reduce((s, v) => s + v, 0) / list.length
          : list.reduce((s, v) => s + v, 0);
      return { ...kr, teamProgress };
    }),
  }));
}

// Hitung achievement objective pakai KR weights khusus per member
function calcObjectiveAchievementForMember(obj: ObjWithKRs, krAssignments: KRAssignment[]): number {
  if (krAssignments.length === 0) return calcObjectiveAchievement(obj);
  const totalWeight = krAssignments.reduce((s: number, kra: KRAssignment) => s + kra.weight, 0);
  if (totalWeight === 0) return calcObjectiveAchievement(obj);
  return krAssignments.reduce((s: number, kra: KRAssignment) => {
    const kr = obj.keyResults.find((k) => k.id === kra.keyResultId);
    if (!kr) return s;
    // Per member, use their own progress + optional individual target
    const effectiveTarget = (kra.target != null && kra.target > 0) ? kra.target : kr.target;
    const memberKR: KR = { ...kr, target: effectiveTarget, teamProgress: kra.progress, leadProgress: null };
    return s + (calcKRAchievement(memberKR) * kra.weight) / totalWeight;
  }, 0);
}

// Hitung pencapaian member berdasarkan assignment ke objectives + KR progress mereka sendiri
export function calcMemberAchievement(assignments: Assignment[], objectives: ObjWithKRs[]): number {
  if (assignments.length === 0) return 0;
  const objMap = new Map(objectives.map((o) => [o.id, o]));
  const totalWeight = assignments.reduce((s: number, a: Assignment) => s + a.weight, 0);
  if (totalWeight === 0) return 0;
  return assignments.reduce((s: number, a: Assignment) => {
    const obj = a.objective ?? objMap.get(a.objectiveId);
    if (!obj) return s;
    const objAchievement =
      a.krAssignments && a.krAssignments.length > 0
        ? calcObjectiveAchievementForMember(obj, a.krAssignments)
        : calcObjectiveAchievement(obj);
    return s + (objAchievement * a.weight) / totalWeight;
  }, 0);
}

// Legacy: untuk Member yang punya objectives sendiri
export function calcUserAchievement(objectives: ObjWithKRs[]): number {
  if (objectives.length === 0) return 0;
  const totalWeight = objectives.reduce((s: number, o: ObjWithKRs) => s + o.weight, 0);
  if (totalWeight === 0) return 0;
  return objectives.reduce(
    (s: number, o: ObjWithKRs) => s + (calcObjectiveAchievement(o) * o.weight) / totalWeight,
    0
  );
}
