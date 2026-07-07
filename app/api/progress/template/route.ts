import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId") ?? session.user.id;
  const quarterIdParam = searchParams.get("quarterId");

  const quarter = quarterIdParam
    ? await prisma.quarter.findUnique({ where: { id: quarterIdParam } })
    : await prisma.quarter.findFirst({ where: { isActive: true } });
  if (!quarter) return new Response("Quarter not found.", { status: 404 });

  // Fetch objectives for this quarter
  const objectives = await prisma.objective.findMany({
    where: { userId: leadId, quarterId: quarter.id },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });
  const objIds = objectives.map((o) => o.id);

  // Fetch all members + assignments for this quarter
  const members = await prisma.teamMember.findMany({
    where: { leadId },
    orderBy: { name: "asc" },
    include: {
      assignments: {
        where: { objectiveId: { in: objIds } },
        include: {
          objective: { select: { title: true } },
          krAssignments: {
            include: {
              keyResult: { select: { title: true, target: true, unit: true } },
            },
          },
        },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";

  const AMBER  = "FFFBBF24";
  const DARK   = "FF1E293B";
  const BLUE   = "FFEFF6FF";
  const INPUT  = "FFFFFBEB";
  const GREY   = "FFF8FAFC";

  // ── Petunjuk sheet ────────────────────────────────────────────────────────────
  const info = wb.addWorksheet("📋 Petunjuk");
  info.getColumn("A").width = 28;
  info.getColumn("B").width = 68;

  const titleCell = info.getCell("A1");
  titleCell.value = "📋 Panduan Update Progress via Excel";
  titleCell.font = { name: "Arial", bold: true, size: 13, color: { argb: DARK } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
  info.getRow(1).height = 30;

  const guide: [string, string][] = [
    ["", ""],
    ["📌 CARA PENGGUNAAN", ""],
    ["1.", "Buka sheet \"Progress\" (tab below)"],
    ["2.", "Fill column G (Progress) for every member & KR"],
    ["3.", "Columns A-F and H are reference only — do not change"],
    ["4.", "Upload file ini via tombol \"Import Progress\" in the app"],
    ["", ""],
    ["📊 COLUMN GUIDE", ""],
    ["A  ID", "Unique KR assignment ID — DO NOT change, used for matching"],
    ["B  Member", "Member name"],
    ["C  Objective", "Judul objective"],
    ["D  Key Result", "Judul key result"],
    ["E  Target", "Target (division or individual)"],
    ["F  Satuan", "Satuan pengukuran"],
    ["G  Progress", "← FILL THIS: the member's latest progress value"],
    ["H  Achievement (%)", "Calculated automatically (for reference)"],
    ["", ""],
    ["⚠️ ATURAN PENTING", ""],
    ["•", "Only column G (Progress) needs to be filled"],
    ["•", "Leave blank or enter 0 if there is no progress yet"],
    ["•", "Progress value cannot be negative"],
    ["•", "Import only updates progress — weights and targets stay unchanged"],
  ];

  let r = 2;
  for (const [a, b] of guide) {
    const row = info.getRow(r);
    if (a.startsWith("📌") || a.startsWith("📊") || a.startsWith("⚠️")) {
      row.getCell(1).value = a;
      row.getCell(1).font = { name: "Arial", bold: true, size: 11, color: { argb: "FFB45309" } };
      row.height = 22;
    } else if (a === "") {
      row.height = 8;
    } else {
      row.getCell(1).value = a;
      row.getCell(1).font = { name: "Arial", size: 10, color: { argb: "FF374151" } };
      row.getCell(2).value = b;
      row.getCell(2).font = { name: "Arial", size: 10, color: { argb: a === "G  Progress" ? "FFB45309" : "FF374151" }, bold: a === "G  Progress" };
      row.height = 18;
    }
    r++;
  }

  // ── Progress sheet ────────────────────────────────────────────────────────────
  const sheet = wb.addWorksheet("Progress", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 2 }],
  });

  // Row 1: title
  sheet.mergeCells("A1:H1");
  const t = sheet.getCell("A1");
  t.value = `📈 Update Progress OKR — ${quarter.name}`;
  t.font = { name: "Arial", bold: true, size: 13, color: { argb: DARK } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
  t.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 30;

  // Row 2: headers
  const headers = ["ID (do not change)", "Member", "Objective", "Key Result", "Target", "Satuan", "Progress ✏️", "Achievement (%)"];
  const hRow = sheet.getRow(2);
  hRow.height = 24;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i === 6 ? AMBER : "FFF1F5F9" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
  });

  let rowIdx = 3;

  for (const member of members) {
    for (const assignment of member.assignments) {
      for (const kra of assignment.krAssignments) {
        const kr = kra.keyResult;
        const effectiveTarget = kra.target ?? kr.target;
        const pct = effectiveTarget > 0 ? Math.min((kra.progress / effectiveTarget) * 100, 100) : 0;
        const altBg = rowIdx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";

        const row = sheet.getRow(rowIdx);
        row.height = 20;

        const set = (col: number, val: string | number | null, bg?: string, bold?: boolean, color?: string) => {
          const cell = row.getCell(col);
          cell.value = val;
          cell.font = { name: "Arial", size: 10, bold, color: { argb: color ?? "FF374151" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg ?? altBg } };
          cell.alignment = { vertical: "middle", horizontal: col <= 1 || col >= 5 ? "center" : "left" };
        };

        // A: KRA ID (reference, do not touch)
        set(1, kra.id, GREY, false, "FF94A3B8");
        // B: Member
        set(2, member.name, altBg, true);
        // C: Objective
        set(3, assignment.objective.title, BLUE);
        // D: Key Result
        set(4, kr.title, BLUE);
        // E: Target
        set(5, effectiveTarget, altBg, false, "FF64748B");
        // F: Unit
        set(6, kr.unit, altBg, false, "FF94A3B8");
        // G: Progress (editable)
        set(7, kra.progress, INPUT, true, "FF1E293B");
        // H: Pencapaian
        const { font: _f, fill: _fl, ..._ } = row.getCell(8) as any; void _f; void _fl; void _;
        const achCell = row.getCell(8);
        achCell.value = parseFloat(pct.toFixed(1));
        achCell.numFmt = '0.0"%"';
        const achColor = pct >= 100 ? { bg: "FFD1FAE5", fg: "FF065F46" } : pct >= 70 ? { bg: "FFFEF3C7", fg: "FF92400E" } : { bg: "FFFEE2E2", fg: "FF991B1B" };
        achCell.font = { name: "Arial", size: 10, bold: true, color: { argb: achColor.fg } };
        achCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: achColor.bg } };
        achCell.alignment = { vertical: "middle", horizontal: "center" };

        rowIdx++;
      }
    }
  }

  if (rowIdx === 3) {
    // No assignments — show placeholder
    sheet.mergeCells(`A3:H3`);
    const empty = sheet.getCell("A3");
    empty.value = "⚠️  No assignments for this quarter yet. Do the distribution first.";
    empty.font = { name: "Arial", italic: true, size: 10, color: { argb: "FF94A3B8" } };
    empty.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(3).height = 24;
  }

  // Legend
  const legRow = sheet.getRow(rowIdx + 1);
  sheet.mergeCells(`A${rowIdx + 1}:H${rowIdx + 1}`);
  legRow.getCell(1).value = "💡  Only column G (Progress) needs to be filled. Do not change the other columns.";
  legRow.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF94A3B8" } };
  legRow.height = 18;

  // Column widths
  [26, 22, 34, 34, 10, 10, 14, 16].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="progress-okr-${quarter.name.replace(/\s+/g, "-").toLowerCase()}.xlsx"`,
    },
  });
}
