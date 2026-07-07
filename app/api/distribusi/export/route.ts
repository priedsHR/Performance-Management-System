import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

const AMBER    = "FFFBBF24";
const DARK     = "FF1E293B";
const GREEN_BG = "FFD1FAE5";
const GREEN_FG = "FF065F46";
const AMBER_BG = "FFFEF3C7";
const AMBER_FG = "FF92400E";
const RED_BG   = "FFFEE2E2";
const RED_FG   = "FF991B1B";
const CUSTOM_BG = "FFEFF6FF"; // light blue = custom individual target

function achColors(v: number) {
  if (v >= 100) return { bg: GREEN_BG, fg: GREEN_FG };
  if (v >= 70)  return { bg: AMBER_BG, fg: AMBER_FG };
  return               { bg: RED_BG,   fg: RED_FG };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId") ?? session.user.id;
  const quarterIdParam = searchParams.get("quarterId");

  const activeQuarter = quarterIdParam
    ? await prisma.quarter.findUnique({ where: { id: quarterIdParam } })
    : await prisma.quarter.findFirst({ where: { isActive: true } });
  if (!activeQuarter) return new Response("Quarter not found.", { status: 404 });

  // Fetch all team members with their full assignment tree
  const members = await prisma.teamMember.findMany({
    where: { leadId },
    orderBy: { name: "asc" },
    include: {
      assignments: {
        include: {
          objective: { select: { id: true, title: true, weight: true } },
          krAssignments: {
            include: {
              keyResult: { select: { id: true, title: true, target: true, unit: true, weight: true } },
            },
          },
        },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";

  const sheet = wb.addWorksheet("Distribusi", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 2 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // Row 1: title
  sheet.mergeCells("A1:J1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `📊 Distribusi OKR — ${activeQuarter.name}`;
  titleCell.font = { name: "Arial", bold: true, size: 13, color: { argb: DARK } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 30;

  // Row 2: headers
  const headers = ["Member", "Objective", "Obj Weight (%)", "Key Result", "Division Target", "Individual Target", "Unit", "KR Weight (%)", "Progress", "Achievement (%)"];
  const hRow = sheet.getRow(2);
  hRow.height = 24;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
  });

  let rowIdx = 3;

  for (const member of members) {
    if (member.assignments.length === 0) continue;

    let memberFirstRow = true;

    for (const assignment of member.assignments) {
      let assignmentFirstRow = true;

      for (const kra of assignment.krAssignments) {
        const kr = kra.keyResult;
        const effectiveTarget = kra.target ?? kr.target;
        const pct = effectiveTarget > 0 ? Math.min((kra.progress / effectiveTarget) * 100, 100) : 0;
        const altBg = rowIdx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";

        const dataRow = sheet.getRow(rowIdx);
        dataRow.height = 20;

        const setCell = (col: number, val: string | number | null, opts?: {
          bold?: boolean; color?: string; bg?: string; align?: ExcelJS.Alignment["horizontal"]; italic?: boolean;
        }) => {
          const cell = dataRow.getCell(col);
          cell.value = val;
          cell.font = { name: "Arial", size: 10, bold: opts?.bold, italic: opts?.italic, color: { argb: opts?.color ?? "FF374151" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts?.bg ?? altBg } };
          cell.alignment = { vertical: "middle", horizontal: opts?.align ?? "left" };
        };

        // Col A: Member name (only on first row of member)
        setCell(1, memberFirstRow ? member.name : null, { bold: memberFirstRow });
        // Col B: Objective (only on first row of assignment)
        setCell(2, assignmentFirstRow ? assignment.objective.title : null);
        // Col C: Bobot Obj (only on first row of assignment)
        setCell(3, assignmentFirstRow ? assignment.weight : null, { align: "center" });
        // Col D: KR title
        setCell(4, kr.title);
        // Col E: Target divisi
        setCell(5, kr.target, { align: "center", color: "FF94A3B8" });
        // Col F: Target individu (highlight if custom)
        if (kra.target !== null) {
          setCell(6, kra.target, { align: "center", bg: CUSTOM_BG, bold: true, color: "FF1D4ED8" });
        } else {
          setCell(6, null, { align: "center", color: "FFD1D5DB", italic: true });
          dataRow.getCell(6).value = "(division)";
        }
        // Col G: Unit
        setCell(7, kr.unit, { align: "center", color: "FF94A3B8" });
        // Col H: Bobot KR
        setCell(8, kra.weight, { align: "center" });
        // Col I: Progress
        setCell(9, `${kra.progress} / ${effectiveTarget}`, { align: "center" });

        // Col J: Pencapaian — color coded
        const { bg: achBg, fg: achFg } = achColors(pct);
        const achCell = dataRow.getCell(10);
        achCell.value = parseFloat(pct.toFixed(1));
        achCell.numFmt = '0.0"%"';
        achCell.font = { name: "Arial", size: 10, bold: true, color: { argb: achFg } };
        achCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: achBg } };
        achCell.alignment = { vertical: "middle", horizontal: "center" };

        memberFirstRow = false;
        assignmentFirstRow = false;
        rowIdx++;
      }

      // Bottom border after each assignment
      if (assignment.krAssignments.length > 0) {
        for (let c = 1; c <= 10; c++) {
          sheet.getRow(rowIdx - 1).getCell(c).border = {
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        }
      }
    }

    // Thicker border after member
    if (!memberFirstRow) {
      for (let c = 1; c <= 10; c++) {
        sheet.getRow(rowIdx - 1).getCell(c).border = {
          bottom: { style: "medium", color: { argb: "FFE2E8F0" } },
        };
      }
    }
  }

  // Legend row
  const legendRow = sheet.getRow(rowIdx + 1);
  sheet.mergeCells(`A${rowIdx + 1}:J${rowIdx + 1}`);
  legendRow.getCell(1).value = "💡  Blue column F = individual target differs from the division target";
  legendRow.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF94A3B8" } };
  legendRow.height = 18;

  // Column widths
  [20, 32, 14, 32, 14, 16, 10, 12, 18, 16].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="distribusi-okr-${activeQuarter.name.replace(/\s+/g, "-").toLowerCase()}.xlsx"`,
    },
  });
}
