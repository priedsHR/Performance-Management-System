import { auth } from "@/auth";
import ExcelJS from "exceljs";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";
  wb.created = new Date();

  // ── Sheet 1: Petunjuk ────────────────────────────────────────────────────────
  const info = wb.addWorksheet("Instructions");
  info.getColumn("A").width = 28;
  info.getColumn("B").width = 72;

  const title = info.getCell("A1");
  title.value = "OKR Template Filling Guide";
  title.font = { name: "Arial", bold: true, size: 14, color: { argb: "FF1E293B" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBBF24" } };
  title.alignment = { vertical: "middle" };
  info.getRow(1).height = 32;

  const guide: [string, string][] = [
    ["", ""],
    ["HOW TO USE", ""],
    ["1.", 'Open sheet "OKR" (tab below)'],
    ["2.", "Enter data starting from row 3 (below the header rows)"],
    ["3.", "One objective can have many Key Results. Write the Objective name only on its first KR row. For subsequent KR rows of the same objective: leave columns A & B blank."],
    ["4.", "Total Objective Weight (%) must be 100"],
    ["5.", "Total KR Weight (%) per objective must be 100"],
    ["6.", "Save the file, then upload it via the Import button on the OKR page"],
    ["", ""],
    ["COLUMN GUIDE", ""],
    ["A  Objective", "Objective name (fill only on the first KR row of each objective)"],
    ["B  Objective Weight (%)", "Objective weight, grand total = 100 (fill only on the first row)"],
    ["C  Key Result", "Key result name — REQUIRED on every row"],
    ["D  Target", "Target number (required, numbers only)"],
    ["E  Unit", "Units: %, pcs, x, score, day, month, people, other"],
    ["F  KR Weight (%)", "KR weight, total per objective = 100"],
    ["", ""],
    ["EXAMPLE", ""],
    ["Row 3:", "A=Increase Revenue, B=60, C=Revenue Target Q1, D=500, E=million, F=100"],
    ["Row 4:", "A=(blank), B=(blank), C=Wrong — the second KR of the same objective must stay in the same objective"],
    ["", ""],
    ["IMPORTANT RULES", ""],
    ["*", "Do not change or delete the header rows (rows 1 and 2) in the OKR sheet"],
    ["*", "Column C (Key Result) must always be filled"],
    ["*", "Rows with a blank column C are ignored"],
    ["*", "Submitted objectives are kept; only Drafts are replaced"],
  ];

  let r = 2;
  for (const [a, b] of guide) {
    const row = info.getRow(r);
    if (a === "HOW TO USE" || a === "COLUMN GUIDE" || a === "EXAMPLE" || a === "IMPORTANT RULES") {
      const cell = row.getCell(1);
      cell.value = a;
      cell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFB45309" } };
      row.height = 22;
    } else if (a === "") {
      row.height = 8;
    } else {
      row.getCell(1).value = a;
      row.getCell(1).font = { name: "Arial", size: 10, color: { argb: "FF374151" } };
      row.getCell(2).value = b;
      row.getCell(2).font = { name: "Arial", size: 10, color: { argb: "FF374151" } };
      row.height = 18;
    }
    r++;
  }

  // ── Sheet 2: OKR ─────────────────────────────────────────────────────────────
  const sheet = wb.addWorksheet("OKR", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 2 }],
  });

  const AMBER_BG = "FFFBBF24";
  const HEADER_FG = "FF1E293B";

  const headers = ["Objective", "Objective Weight (%)", "Key Result", "Target", "Unit", "KR Weight (%)"];
  const colWidths = [38, 20, 38, 12, 14, 14];

  // Row 1: headers
  const hRow = sheet.getRow(1);
  hRow.height = 28;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 11, color: { argb: HEADER_FG } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_BG } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium", color: { argb: "FFD97706" } } };
  });

  // Row 2: example / instruction row
  const ex = sheet.getRow(2);
  ex.height = 18;
  const exData = [
    "EXAMPLE: Increase Revenue",
    "60",
    "EXAMPLE: Achieve Q1 Revenue of 500 million",
    "500",
    "juta",
    "100",
  ];
  exData.forEach((v, i) => {
    const cell = ex.getCell(i + 1);
    cell.value = v;
    cell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF94A3B8" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 || i === 2 ? "left" : "center" };
  });

  // Rows 3+: clean empty rows with minimal styling — NO pre-filled styling that could confuse parsing
  // Just set column widths and leave cells empty
  colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  // Serialize
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-okr.xlsx"',
    },
  });
}
