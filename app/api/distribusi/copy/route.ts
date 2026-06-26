import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function norm(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if ([0x200b,0x200c,0x200d,0x200e,0x200f,0x00ad,0xfeff,0x2028,0x2029].includes(cp)) continue;
    if (cp === 0x00a0 || cp === 0x1680 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x202f || cp === 0x205f || cp === 0x3000) { out += " "; continue; }
    out += ch;
  }
  return out.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().toLowerCase();
}

// GET — full preview with objectives + KRs for checkbox selection
export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const fromQuarterId = searchParams.get("fromQuarterId");
  const leadId = searchParams.get("leadId") ?? session.user.id;
  if (!fromQuarterId) return Response.json({ error: "fromQuarterId required" }, { status: 400 });

  const members = await prisma.teamMember.findMany({
    where: { leadId },
    include: {
      assignments: {
        where: { objective: { quarterId: fromQuarterId } },
        include: {
          objective: { select: { title: true } },
          krAssignments: {
            include: { keyResult: { select: { title: true, unit: true } } },
          },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const preview = members
    .filter((m) => m.assignments.length > 0)
    .map((m) => ({
      name: m.name,
      objectives: m.assignments.map((a) => ({
        title: a.objective.title,
        weight: a.weight,
        krs: a.krAssignments.map((kra) => ({
          title: kra.keyResult.title,
          unit: kra.keyResult.unit,
          weight: kra.weight,
          target: kra.target,
        })),
      })),
    }));

  return Response.json({ members: preview });
}

// POST — copy with granular KR-level selection
// selections: Array<{ memberName: string; krKeys: string[] }>
// krKeys format: "objectiveTitle::krTitle"  (exact titles from preview)
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { fromQuarterId, toQuarterId, selections } = body;
  const leadId: string = body.leadId ?? session.user.id;

  if (!fromQuarterId || !toQuarterId)
    return Response.json({ error: "fromQuarterId dan toQuarterId wajib diisi." }, { status: 400 });

  // Build selection map: norm(memberName) → Set<norm("objTitle::krTitle")>
  type SelEntry = { memberName: string; krKeys: string[] };
  const selMap = new Map<string, Set<string>>();
  if (Array.isArray(selections) && selections.length > 0) {
    for (const s of selections as SelEntry[]) {
      if (s.krKeys.length > 0)
        selMap.set(norm(s.memberName), new Set(s.krKeys.map((k) => norm(k))));
    }
  }
  const useSel = selMap.size > 0;

  // Fetch all source members — selection filtering is done in-loop via norm()
  const sourceMembers = await prisma.teamMember.findMany({
    where: { leadId },
    include: {
      assignments: {
        where: { objective: { quarterId: fromQuarterId } },
        include: {
          objective: true,
          krAssignments: { include: { keyResult: true } },
        },
      },
    },
  });

  // Fetch target objectives + KRs
  const targetObjectives = await prisma.objective.findMany({
    where: { userId: leadId, quarterId: toQuarterId },
    include: { keyResults: true },
  });
  if (targetObjectives.length === 0)
    return Response.json({ error: "Quarter tujuan belum punya objective. Buat OKR Divisi dulu." }, { status: 400 });

  const targetObjMap = new Map(targetObjectives.map((o) => [norm(o.title), o]));
  const targetKrMap = new Map(
    targetObjectives.flatMap((o) => o.keyResults.map((kr) => [`${o.id}::${norm(kr.title)}`, kr]))
  );

  let copiedAssignments = 0, copiedKRAs = 0;
  const errors: string[] = [];

  for (const member of sourceMembers) {
    if (member.assignments.length === 0) continue;

    const memberNorm = norm(member.name);
    // Skip if selection active and member not in it
    if (useSel && !selMap.has(memberNorm)) continue;

    const allowedKrKeys = selMap.get(memberNorm); // Set<"normObjTitle::normKrTitle"> or undefined

    for (const srcAss of member.assignments) {
      const srcObjNorm = norm(srcAss.objective.title);

      // Skip entire objective if none of its KRs are selected
      if (allowedKrKeys) {
        const hasAny = srcAss.krAssignments.some((kra) =>
          allowedKrKeys.has(`${srcObjNorm}::${norm(kra.keyResult.title)}`)
        );
        if (!hasAny) continue;
      }

      const targetObj = targetObjMap.get(srcObjNorm)
        ?? targetObjectives.find((o) => { const on = norm(o.title); return on.includes(srcObjNorm) || srcObjNorm.includes(on); });
      if (!targetObj) {
        errors.push(`Objective "${srcAss.objective.title}" tidak ditemukan di quarter tujuan.`);
        continue;
      }

      let targetAss;
      try {
        targetAss = await prisma.objectiveAssignment.upsert({
          where: { memberId_objectiveId: { memberId: member.id, objectiveId: targetObj.id } },
          create: { memberId: member.id, objectiveId: targetObj.id, weight: srcAss.weight },
          update: { weight: srcAss.weight },
        });
        copiedAssignments++;
      } catch (e) {
        errors.push(`Assignment ${member.name} → "${srcAss.objective.title}": ${String(e)}`);
        continue;
      }

      for (const srcKra of srcAss.krAssignments) {
        const krNorm = norm(srcKra.keyResult.title);
        const krSelKey = `${srcObjNorm}::${krNorm}`;

        // Skip if this KR not selected
        if (allowedKrKeys && !allowedKrKeys.has(krSelKey)) continue;

        const krKey = `${targetObj.id}::${krNorm}`;
        const targetKr = targetKrMap.get(krKey)
          ?? targetObj.keyResults.find((k) => { const kn = norm(k.title); return kn.includes(krNorm) || krNorm.includes(kn); });
        if (!targetKr) {
          errors.push(`KR "${srcKra.keyResult.title}" tidak ditemukan di "${targetObj.title}".`);
          continue;
        }

        try {
          await prisma.kRAssignment.upsert({
            where: { assignmentId_keyResultId: { assignmentId: targetAss.id, keyResultId: targetKr.id } },
            create: { assignmentId: targetAss.id, keyResultId: targetKr.id, weight: srcKra.weight, progress: 0, target: srcKra.target },
            update: { weight: srcKra.weight, target: srcKra.target },
          });
          copiedKRAs++;
        } catch (e) {
          errors.push(`KRA ${member.name} → "${srcKra.keyResult.title}": ${String(e)}`);
        }
      }
    }
  }

  return Response.json({
    success: true,
    message: `Berhasil menyalin ${copiedAssignments} assignment (${copiedKRAs} KR). Progress yang sudah diisi tetap terjaga.`,
    errors: errors.length > 0 ? errors : undefined,
  });
}
