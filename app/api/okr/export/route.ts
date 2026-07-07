import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { calcKRAchievement, calcObjectiveAchievement, calcUserAchievement } from "@/lib/calculations";

const AMBER    = "FFFBBF24";
const DARK     = "FF1E293B";
const GREEN_BG = "FFD1FAE5";
const GREEN_FG = "FF065F46";
const AMBER_BG = "FFFEF3C7";
const AMBER_FG = "FF92400E";
const RED_BG   = "FFFEE2E2";
const RED_FG   = "FF991B1B";

function achColors(v: number) {
  if (v >= 100) return { bg: GREEN_BG, fg: GREEN_FG };
  if (v >= 70)  return { bg: AMBER_BG, fg: AMBER_FG };
  return               { bg: RED_BG,   fg: RED_FG   };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarterId");

  const quarter = quarterId
    ? await prisma.quarter.findUnique({ where: { id: quarterId } })
    : await prisma.quarter.findFirst({ where: { isActive: true } });

  if (!quarter) return new Response("Quarter not found.", { status: 404 });

  const objectives = await prisma.objective.findMany({
    where: { userId: session.user.id, quarterId: quarter.id },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });

  // ── Build workbook ───────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";
  wb.created = new Date();

  const sheet = wb.addWorksheet("OKR", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 2 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // Row 1: title
  sheet.mergeCells("A1:J1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `📊 OKR Export — ${quarter.name} — ${session.user.name ?? ""}`;
  titleCell.font = { name: "Arial", bold: true, size: 13, color: { argb: DARK } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 30;

  // Row 2: headers
  const headers = [
    "Objective", "Obj Weight (%)", "Status",
    "Key Result", "Target", "Satuan", "KR Weight (%)",
    "Progress", "Achievement (%)", "Catatan",
  ];
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

  // Data rows
  let rowIdx = 3;
  const overallAch = calcUserAchievement(objectives as Parameters<typeof calcUserAchievement>[0]);

  for (const obj of objectives) {
    const objAch = calcObjectiveAchievement(obj as Parameters<typeof calcObjectiveAchievement>[0]);

    for (let ki = 0; ki < obj.keyResults.length; ki++) {
      const kr = obj.keyResults[ki];
      const krAch = calcKRAchievement(kr as Parameters<typeof calcKRAchievement>[0]);
      const progress = kr.leadProgress ?? kr.teamProgress;

      const dataRow = sheet.getRow(rowIdx);
      dataRow.height = 20;
      const altBg = rowIdx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";

      const setCell = (
        col: number,
        val: string | number | null,
        opts?: { bold?: boolean; color?: string; bg?: string; align?: ExcelJS.Alignment["horizontal"] }
      ) => {
        const cell = dataRow.getCell(col);
        cell.value = val;
        cell.font = { name: "Arial", size: 10, bold: opts?.bold, color: { argb: opts?.color ?? "FF374151" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts?.bg ?? altBg } };
        cell.alignment = { vertical: "middle", horizontal: opts?.align ?? "left" };
      };

      // Only fill objective columns on the first KR row
      if (ki === 0) {
        setCell(1, obj.title, { bold: true });
        setCell(2, obj.weight, { align: "center" });
        const statusLabel = obj.status === "SUBMITTED" ? "✅ Terkumpul" : "📝 Draft";
        setCell(3, statusLabel, {
          align: "center",
          color: obj.status === "SUBMITTED" ? GREEN_FG : "FF64748B",
        });
      } else {
        setCell(1, null); setCell(2, null); setCell(3, null);
      }

      setCell(4, kr.title);
      setCell(5, kr.target, { align: "center" });
      setCell(6, kr.unit, { align: "center" });
      setCell(7, kr.weight, { align: "center" });
      setCell(8, `${progress} / ${kr.target}`, { align: "center" });

      // Achievement % — color-coded
      const { bg: achBg, fg: achFg } = achColors(krAch);
      const achCell = dataRow.getCell(9);
      achCell.value = parseFloat(krAch.toFixed(1));
      achCell.numFmt = '0.0"%"';
      achCell.font = { name: "Arial", size: 10, bold: true, color: { argb: achFg } };
      achCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: achBg } };
      achCell.alignment = { vertical: "middle", horizontal: "center" };

      // Notes col
      const notes: string[] = [];
      if (kr.leadProgress !== null) notes.push("🔒 di-override lead");
      if (ki === 0 && obj.keyResults.length > 1) notes.push(`Obj Achievement: ${objAch.toFixed(1)}%`);
      const noteCell = dataRow.getCell(10);
      noteCell.value = notes.join(" · ") || null;
      noteCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF94A3B8" } };
      noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: altBg } };
      noteCell.alignment = { vertical: "middle", horizontal: "left" };

      // Bottom border on last KR of objective
      if (ki === obj.keyResults.length - 1) {
        for (let c = 1; c <= 10; c++) {
          dataRow.getCell(c).border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
        }
      }

      rowIdx++;
    }
  }

  // Summary row
  const sumRowIdx = rowIdx + 1;
  sheet.mergeCells(`A${sumRowIdx}:H${sumRowIdx}`);
  const sumRow = sheet.getRow(sumRowIdx);
  sumRow.height = 28;

  const sumLabel = sumRow.getCell(1);
  sumLabel.value = "🏆 Total OKR Achievement";
  sumLabel.font = { name: "Arial", bold: true, size: 11, color: { argb: DARK } };
  sumLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  sumLabel.alignment = { horizontal: "right", vertical: "middle" };

  const { bg: sBg, fg: sFg } = achColors(overallAch);
  const sumVal = sumRow.getCell(9);
  sumVal.value = parseFloat(overallAch.toFixed(1));
  sumVal.numFmt = '0.0"%"';
  sumVal.font = { name: "Arial", bold: true, size: 13, color: { argb: sFg } };
  sumVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sBg } };
  sumVal.alignment = { horizontal: "center", vertical: "middle" };

  // Column widths
  [36, 14, 14, 36, 10, 10, 12, 16, 16, 30].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `okr-${quarter.name.replace(/\s+/g, "-").toLowerCase()}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
