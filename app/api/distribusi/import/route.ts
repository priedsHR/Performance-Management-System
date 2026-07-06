import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

// Normalize title using explicit code-point checks — no invisible literal chars
function norm(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    // Skip zero-width / invisible chars
    if (
      cp === 0x200b || cp === 0x200c || cp === 0x200d ||
      cp === 0x200e || cp === 0x200f || cp === 0x00ad ||
      cp === 0xfeff || cp === 0x2028 || cp === 0x2029
    ) continue;
    // Unicode spaces → ASCII space
    if (
      cp === 0x00a0 || cp === 0x1680 ||
      (cp >= 0x2000 && cp <= 0x200a) ||
      cp === 0x202f || cp === 0x205f || cp === 0x3000
    ) { out += " "; continue; }
    out += ch;
  }
  return out
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase();
}

function readStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    return r === null || r === undefined ? "" : String(r);
  }
  if (typeof v === "object" && "text" in v)
    return String((v as ExcelJS.CellHyperlinkValue).text ?? "");
  if (v instanceof Date) return "";
  return String(v);
}

function readNum(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    const n = typeof r === "number" ? r : parseFloat(String(r ?? ""));
    return isNaN(n) ? null : n;
  }
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  // leadId and quarterId from URL query params (reliable for multipart POST)
  const { searchParams } = new URL(req.url);
  const hintQuarterId = searchParams.get("quarterId") || null;
  const urlLeadId = searchParams.get("leadId") || null;

  let fileBuffer: ArrayBuffer;
  let leadId: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string")
      return Response.json({ error: "File tidak ditemukan." }, { status: 400 });
    fileBuffer = await (file as File).arrayBuffer();
    leadId = urlLeadId ?? (formData.get("leadId") as string) ?? session.user.id;
  } catch {
    return Response.json({ error: "Failed to read the form." }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(fileBuffer); } catch {
    return Response.json({ error: "File Excel tidak valid." }, { status: 400 });
  }

  let sheet: ExcelJS.Worksheet | undefined = wb.getWorksheet("Distribusi");
  if (!sheet) {
    for (const ws of wb.worksheets) {
      if (!/petunjuk/i.test(ws.name)) { sheet = ws; break; }
    }
  }
  if (!sheet)
    return Response.json({ error: "Sheet 'Distribusi' tidak ditemukan." }, { status: 400 });

  // ── Parse rows first — quarter detection comes after ─────────────────────────
  type RowData = {
    memberName: string; objectiveTitle: string; objectiveWeight: number;
    krTitle: string; individualTarget: number | null; krWeight: number;
  };
  const rows: RowData[] = [];
  let lastMember = "";
  let lastObjective = "";
  let lastObjectiveWeight = 0;
  const parseErrors: string[] = [];
  const maxRow = sheet.rowCount;

  for (let rowNum = 3; rowNum <= maxRow; rowNum++) {
    const row = sheet.getRow(rowNum);
    const memberName = readStr(row.getCell(1)).replace(/[\r\n]+/g, " ").trim();
    const objTitle   = readStr(row.getCell(2)).replace(/[\r\n]+/g, " ").trim();
    const objWeight  = readNum(row.getCell(3)) ?? lastObjectiveWeight;
    const krTitle    = readStr(row.getCell(4)).replace(/[\r\n]+/g, " ").trim();
    const indTarget  = readNum(row.getCell(5));
    const krWeight   = readNum(row.getCell(7)) ?? 0;

    if (memberName) lastMember = memberName;
    if (objTitle)   { lastObjective = objTitle; lastObjectiveWeight = objWeight; }
    else if (objWeight > 0) lastObjectiveWeight = objWeight;

    if (!krTitle) continue;
    if (!lastMember) { parseErrors.push(`Row ${rowNum}: KR "${krTitle}" has no member.`); continue; }
    if (!lastObjective) { parseErrors.push(`Baris ${rowNum}: KR "${krTitle}" tidak punya objective.`); continue; }

    rows.push({ memberName: lastMember, objectiveTitle: lastObjective, objectiveWeight: lastObjectiveWeight, krTitle, individualTarget: indTarget, krWeight });
  }

  if (rows.length === 0)
    return Response.json({ error: "Tidak ada data KR yang terbaca. Pastikan kolom D (Key Result) terisi.", debug: { maxRow, parseErrors } }, { status: 400 });

  // ── Auto-detect which quarter the file belongs to ────────────────────────────
  const fileObjNorms = [...new Set(rows.map((r) => norm(r.objectiveTitle)))];

  // Fetch ALL objectives for this lead across all quarters
  const allLeadObjs = await prisma.objective.findMany({
    where: { userId: leadId },
    select: { id: true, title: true, quarterId: true },
  });

  // Find which quarters contain objectives that match the file
  const matchingQuarterIds = new Set<string>();
  for (const obj of allLeadObjs) {
    const on = norm(obj.title);
    if (fileObjNorms.some((fn) => fn === on || fn.includes(on) || on.includes(fn))) {
      matchingQuarterIds.add(obj.quarterId);
    }
  }

  let resolvedQuarterId: string;

  if (matchingQuarterIds.size === 1) {
    // Perfect: exactly one quarter matches — use it regardless of hintQuarterId
    [resolvedQuarterId] = matchingQuarterIds;
  } else if (matchingQuarterIds.size > 1) {
    // Multiple quarters match — use the hint if it's one of them, else error
    if (hintQuarterId && matchingQuarterIds.has(hintQuarterId)) {
      resolvedQuarterId = hintQuarterId;
    } else {
      const quarters = await prisma.quarter.findMany({ where: { id: { in: [...matchingQuarterIds] } }, select: { name: true } });
      return Response.json({ error: `Objectives found in several quarters: ${quarters.map((q) => q.name).join(", ")}. Select one of those quarters in the UI, then re-import.` }, { status: 400 });
    }
  } else {
    // Not found in any quarter under this leadId
    const fallback = hintQuarterId
      ? await prisma.quarter.findUnique({ where: { id: hintQuarterId } })
      : await prisma.quarter.findFirst({ where: { isActive: true } });
    return Response.json({
      error: `Tidak ada objective di file yang cocok dengan database. Pastikan kolom B (Objective) tidak diubah dari template.`,
      debug: {
        leadId: leadId.slice(-8),
        hintQuarter: fallback?.name ?? hintQuarterId,
        dbObjectivesForLead: allLeadObjs.map((o) => `${norm(o.title)} [q:${o.quarterId.slice(-6)}]`),
        fileObjNorms,
      },
    }, { status: 400 });
  }

  const resolvedQuarter = await prisma.quarter.findUnique({ where: { id: resolvedQuarterId } });
  if (!resolvedQuarter)
    return Response.json({ error: "Quarter tidak dapat ditemukan." }, { status: 400 });

  // ── Fetch objectives + KRs for the resolved quarter ──────────────────────────
  const objectives = await prisma.objective.findMany({
    where: { userId: leadId, quarterId: resolvedQuarterId },
    include: { keyResults: true },
  });

  const objByTitle = new Map(objectives.map((o) => [norm(o.title), o]));
  const krByKey = new Map(
    objectives.flatMap((o) => o.keyResults.map((kr) => [`${o.id}::${norm(kr.title)}`, kr]))
  );

  // ── Group rows ────────────────────────────────────────────────────────────────
  type MemberGroup = Map<string, { objectiveTitle: string; objectiveWeight: number; krs: RowData[] }>;
  const grouped = new Map<string, MemberGroup>();
  for (const row of rows) {
    if (!grouped.has(row.memberName)) grouped.set(row.memberName, new Map());
    const mg = grouped.get(row.memberName)!;
    const objKey = norm(row.objectiveTitle);
    if (!mg.has(objKey)) mg.set(objKey, { objectiveTitle: row.objectiveTitle, objectiveWeight: row.objectiveWeight, krs: [] });
    mg.get(objKey)!.krs.push(row);
  }

  // ── Load existing members ─────────────────────────────────────────────────────
  const existingMembers = await prisma.teamMember.findMany({ where: { leadId }, select: { id: true, name: true } });
  const existingMemberMap = new Map(existingMembers.map((m) => [norm(m.name), m]));

  const quarterObjIds = objectives.map((o) => o.id);

  let createdMembers = 0, upsertedAssignments = 0, upsertedKRAs = 0;
  const errors: string[] = [...parseErrors];
  const debugLookups: string[] = [];
  debugLookups.push(`Quarter (auto): ${resolvedQuarter.name}`);
  debugLookups.push(`Lead: ${leadId.slice(-8)}`);

  // Track which (memberId, objectiveId) pairs are in this import — for cleanup
  const processedMemberObjKeys = new Set<string>();

  for (const [memberName, memberGroup] of grouped) {
    let member = existingMemberMap.get(norm(memberName));
    if (!member) {
      try {
        member = await prisma.teamMember.create({ data: { name: memberName, leadId } });
        existingMemberMap.set(norm(memberName), member);
        createdMembers++;
      } catch (e) {
        errors.push(`Failed to create member "${memberName}": ${String(e)}`);
        continue;
      }
    }

    for (const [, { objectiveTitle, objectiveWeight, krs }] of memberGroup) {
      const objNorm = norm(objectiveTitle);
      let obj = objByTitle.get(objNorm);

      // Fuzzy fallback
      if (!obj) {
        obj = objectives.find((o) => norm(o.title).includes(objNorm) || objNorm.includes(norm(o.title)));
      }

      debugLookups.push(`Obj "${objNorm}" → ${obj ? `FOUND (${obj.id.slice(-6)})` : "NOT FOUND"}`);
      if (!obj) { errors.push(`Objective tidak ditemukan: "${objectiveTitle}"`); continue; }

      // Upsert assignment — update weight, preserve everything else (progress untouched)
      let assignment;
      try {
        assignment = await prisma.objectiveAssignment.upsert({
          where: { memberId_objectiveId: { memberId: member.id, objectiveId: obj.id } },
          create: { memberId: member.id, objectiveId: obj.id, weight: objectiveWeight },
          update: { weight: objectiveWeight },
        });
        upsertedAssignments++;
        processedMemberObjKeys.add(`${member.id}::${obj.id}`);
      } catch (e) {
        errors.push(`Assignment ${memberName}→${obj.title}: ${String(e)}`);
        continue;
      }

      const processedKrIds = new Set<string>();

      for (const kra of krs) {
        const krNorm = norm(kra.krTitle);
        const krKey = `${obj.id}::${krNorm}`;
        let kr = krByKey.get(krKey);

        // Fuzzy KR fallback
        if (!kr) {
          const fuzzy = obj.keyResults.find((k) => norm(k.title).includes(krNorm) || krNorm.includes(norm(k.title)));
          if (!fuzzy) {
            errors.push(`KR tidak ditemukan: "${kra.krTitle}" di "${obj.title}"`);
            continue;
          }
          kr = fuzzy;
        }

        try {
          // Upsert KR assignment — update weight+target, but NEVER overwrite progress
          await prisma.kRAssignment.upsert({
            where: { assignmentId_keyResultId: { assignmentId: assignment.id, keyResultId: kr.id } },
            create: { assignmentId: assignment.id, keyResultId: kr.id, weight: kra.krWeight, progress: 0, target: kra.individualTarget },
            update: { weight: kra.krWeight, target: kra.individualTarget },
          });
          processedKrIds.add(kr.id);
          upsertedKRAs++;
        } catch (e) {
          errors.push(`KRA ${memberName}→"${kra.krTitle}": ${String(e)}`);
        }
      }

      // Remove KR assignments that are no longer in the file for this assignment
      if (processedKrIds.size > 0) {
        await prisma.kRAssignment.deleteMany({
          where: { assignmentId: assignment.id, keyResultId: { notIn: [...processedKrIds] } },
        });
      }
    }
  }

  // Remove objective assignments no longer in the file (for this quarter)
  const allQuarterAssignments = await prisma.objectiveAssignment.findMany({
    where: { member: { leadId }, objectiveId: { in: quarterObjIds } },
    select: { id: true, memberId: true, objectiveId: true },
  });
  const staleAssignments = allQuarterAssignments.filter(
    (a) => !processedMemberObjKeys.has(`${a.memberId}::${a.objectiveId}`)
  );
  if (staleAssignments.length > 0) {
    await prisma.objectiveAssignment.deleteMany({ where: { id: { in: staleAssignments.map((a) => a.id) } } });
  }

  return Response.json({
    success: true,
    message: `Imported into quarter "${resolvedQuarter.name}": ${upsertedAssignments} assignments, ${upsertedKRAs} KR assignments.` +
      (createdMembers > 0 ? ` (${createdMembers} new members)` : "") +
      ` Existing progress is preserved.`,
    created: { members: createdMembers, assignments: upsertedAssignments, krAssignments: upsertedKRAs },
    errors: errors.length > 0 ? errors : undefined,
    debug: { rowsParsed: rows.length, lookups: debugLookups },
  });
}
