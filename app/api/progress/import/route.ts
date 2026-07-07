import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

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

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId") ?? session.user.id;

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

  // Find the Progress sheet
  let sheet: ExcelJS.Worksheet | undefined = wb.getWorksheet("Progress");
  if (!sheet) {
    for (const ws of wb.worksheets) {
      if (!/petunjuk/i.test(ws.name)) { sheet = ws; break; }
    }
  }
  if (!sheet)
    return Response.json({ error: "Sheet 'Progress' not found." }, { status: 400 });

  // Collect all KRA IDs that belong to this lead (for security check)
  const leadMembers = await prisma.teamMember.findMany({
    where: { leadId },
    select: { id: true },
  });
  const memberIds = leadMembers.map((m) => m.id);

  const allKRAs = await prisma.kRAssignment.findMany({
    where: { assignment: { memberId: { in: memberIds } } },
    select: { id: true },
  });
  const validKraIds = new Set(allKRAs.map((k) => k.id));

  // Parse rows — col A = KRA ID, col G = progress
  type UpdateRow = { kraId: string; progress: number };
  const updates: UpdateRow[] = [];
  const errors: string[] = [];
  const maxRow = sheet.rowCount;

  for (let rowNum = 3; rowNum <= maxRow; rowNum++) {
    const row = sheet.getRow(rowNum);
    const kraId = readStr(row.getCell(1)).trim();
    if (!kraId || kraId.startsWith("⚠️")) continue; // skip empty / placeholder rows

    const progress = readNum(row.getCell(7));
    if (progress === null) continue; // skip rows with no progress value

    if (!validKraIds.has(kraId)) {
      errors.push(`Row ${rowNum}: KRA ID "${kraId.slice(0, 12)}..." is invalid or not part of this division.`);
      continue;
    }

    if (progress < 0) {
      errors.push(`Row ${rowNum}: Progress cannot be negative (${progress}).`);
      continue;
    }

    updates.push({ kraId, progress });
  }

  if (updates.length === 0) {
    return Response.json({
      error: "No progress data could be read. Make sure column G (Progress) is filled and the file uses the correct template.",
      debug: { maxRow, errorCount: errors.length },
    }, { status: 400 });
  }

  // Batch update
  let updated = 0;
  for (const { kraId, progress } of updates) {
    try {
      await prisma.kRAssignment.update({ where: { id: kraId }, data: { progress } });
      updated++;
    } catch (e) {
      errors.push(`Failed to update KRA ${kraId.slice(-8)}: ${String(e)}`);
    }
  }

  return Response.json({
    success: true,
    message: `Updated progress for ${updated} KR assignments.`,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}
