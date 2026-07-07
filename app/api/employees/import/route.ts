import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

function readStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    return r === null || r === undefined ? "" : String(r);
  }
  return String(v);
}

export async function GET() {
  // Download template
  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";

  const sheet = wb.addWorksheet("Karyawan", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  const AMBER = "FFFBBF24";
  const DARK = "FF1E293B";

  const headers = ["Nama*", "Division", "Jabatan/Posisi", "Status (aktif/nonaktif)"];
  const hRow = sheet.getRow(1);
  hRow.height = 26;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 11, color: { argb: DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Example rows
  const examples = [
    ["Budi Santoso", "HR", "Recruiter", "aktif"],
    ["Siti Rahayu", "HR", "HRBP", "aktif"],
    ["Andi Wijaya", "Marketing", "Content Creator", "nonaktif"],
  ];
  examples.forEach((row, i) => {
    const r = sheet.getRow(i + 2);
    row.forEach((val, j) => { r.getCell(j + 1).value = val; });
    r.height = 20;
  });

  [28, 20, 24, 22].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-karyawan.xlsx"',
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  let fileBuffer: ArrayBuffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string")
      return Response.json({ error: "File not found." }, { status: 400 });
    fileBuffer = await (file as File).arrayBuffer();
  } catch {
    return Response.json({ error: "Failed to read the form." }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(fileBuffer); } catch {
    return Response.json({ error: "Invalid Excel file." }, { status: 400 });
  }

  const sheet = wb.getWorksheet("Karyawan") ?? wb.worksheets[0];
  if (!sheet) return Response.json({ error: "Sheet not found." }, { status: 400 });

  let created = 0, updated = 0;
  const errors: string[] = [];

  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const name = readStr(row.getCell(1)).trim();
    if (!name) continue;

    const division = readStr(row.getCell(2)).trim() || null;
    const position = readStr(row.getCell(3)).trim() || null;
    const statusRaw = readStr(row.getCell(4)).trim().toLowerCase();
    const isActive = statusRaw !== "nonaktif" && statusRaw !== "inactive" && statusRaw !== "inactive" && statusRaw !== "false" && statusRaw !== "0";

    try {
      // Upsert by name + division
      const existing = await prisma.employee.findFirst({ where: { name, division: division ?? undefined } });
      if (existing) {
        await prisma.employee.update({ where: { id: existing.id }, data: { division, position, isActive } });
        updated++;
      } else {
        await prisma.employee.create({ data: { name, division, position, isActive } });
        created++;
      }
    } catch (e) {
      errors.push(`Row ${rowNum} "${name}": ${String(e)}`);
    }
  }

  return Response.json({
    success: true,
    message: `Done: ${created} new employees, ${updated} updated.`,
    created, updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}
