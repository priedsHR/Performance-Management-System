import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

function readCellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  // richText (bold/italic mix)
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("").trim();
  // formula — use cached result
  if (typeof v === "object" && "result" in v) {
    const res = (v as ExcelJS.CellFormulaValue).result;
    return res === null || res === undefined ? "" : String(res).trim();
  }
  // hyperlink
  if (typeof v === "object" && "text" in v)
    return String((v as ExcelJS.CellHyperlinkValue).text ?? "").trim();
  // date
  if (v instanceof Date) return "";
  return String(v).trim();
}

function readCellNumber(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && "result" in v) {
    const res = (v as ExcelJS.CellFormulaValue).result;
    const n = typeof res === "number" ? res : parseFloat(String(res ?? ""));
    return isNaN(n) ? 0 : n;
  }
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  let fileBuffer: ArrayBuffer;
  let quarterIdParam: string | null = null;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return Response.json({ error: "File tidak ditemukan." }, { status: 400 });
    fileBuffer = await (file as File).arrayBuffer();
    quarterIdParam = formData.get("quarterId") as string | null;
  } catch {
    return Response.json({ error: "Gagal membaca file." }, { status: 400 });
  }

  const activeQuarter = quarterIdParam
    ? await prisma.quarter.findUnique({ where: { id: quarterIdParam } })
    : await prisma.quarter.findFirst({ where: { isActive: true } });
  if (!activeQuarter) return Response.json({ error: "Quarter tidak ditemukan." }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(fileBuffer); } catch {
    return Response.json({ error: "File Excel tidak valid." }, { status: 400 });
  }

  // Find the data sheet — prefer "OKR", fallback to any non-Petunjuk sheet
  let sheet: ExcelJS.Worksheet | undefined = wb.getWorksheet("OKR");
  if (!sheet) {
    for (const ws of wb.worksheets) {
      if (!/petunjuk/i.test(ws.name)) { sheet = ws; break; }
    }
  }
  if (!sheet) return Response.json({ error: "Sheet 'OKR' tidak ditemukan dalam file." }, { status: 400 });

  // ── Parse rows ───────────────────────────────────────────────────────────────
  type RowData = {
    objective: string; objectiveWeight: number;
    keyResult: string; target: number; unit: string; krWeight: number;
  };

  const rows: RowData[] = [];
  let lastObjective = "";
  let lastObjectiveWeight = 0;
  const skipped: string[] = [];

  // Determine which rows actually have user data (value, not just styling)
  // Use explicit range to avoid phantom rows from template styling
  const maxRow = sheet.rowCount;

  for (let rowNum = 3; rowNum <= maxRow; rowNum++) {
    const row = sheet.getRow(rowNum);

    const objTitle    = readCellString(row.getCell(1));
    const objWeightRaw = readCellNumber(row.getCell(2));
    const krTitle     = readCellString(row.getCell(3));
    const target      = readCellNumber(row.getCell(4));
    const unit        = readCellString(row.getCell(5)) || "pcs";
    const krWeight    = readCellNumber(row.getCell(6)); // col F = Bobot KR (%)

    if (objTitle) {
      lastObjective = objTitle;
      lastObjectiveWeight = objWeightRaw;
    }

    if (!krTitle) continue; // row has no KR — skip

    if (!lastObjective) {
      skipped.push(`Baris ${rowNum}: KR "${krTitle}" tidak punya objective (kolom A kosong).`);
      continue;
    }

    rows.push({
      objective: lastObjective,
      objectiveWeight: lastObjectiveWeight,
      keyResult: krTitle,
      target,
      unit,
      krWeight,
    });
  }

  if (rows.length === 0) {
    return Response.json({
      error: "Tidak ada data yang terbaca. Pastikan menggunakan template resmi dan isi data mulai baris 3, kolom C (Key Result) harus terisi.",
      debug: { sheetName: sheet.name, sheetRowCount: maxRow, skipped },
    }, { status: 400 });
  }

  // ── Group by objective ───────────────────────────────────────────────────────
  type ObjGroup = { title: string; weight: number; krs: { title: string; target: number; unit: string; weight: number }[] };
  const objMap = new Map<string, ObjGroup>();
  for (const r of rows) {
    if (!objMap.has(r.objective))
      objMap.set(r.objective, { title: r.objective, weight: r.objectiveWeight, krs: [] });
    objMap.get(r.objective)!.krs.push({ title: r.keyResult, target: r.target, unit: r.unit, weight: r.krWeight });
  }

  // ── Delete existing DRAFTs ───────────────────────────────────────────────────
  const existingDrafts = await prisma.objective.findMany({
    where: { userId, quarterId: activeQuarter.id, status: "DRAFT" },
    select: { id: true },
  });
  if (existingDrafts.length > 0) {
    await prisma.objective.deleteMany({ where: { id: { in: existingDrafts.map((o) => o.id) } } });
  }

  // ── Create ───────────────────────────────────────────────────────────────────
  let createdObj = 0, createdKR = 0;
  const errors: string[] = [];

  for (const obj of objMap.values()) {
    try {
      await prisma.objective.create({
        data: {
          title: obj.title,
          weight: obj.weight,
          userId,
          quarterId: activeQuarter.id,
          keyResults: {
            create: obj.krs.map((kr) => ({
              title: kr.title,
              target: kr.target,
              unit: kr.unit,
              weight: kr.weight,
            })),
          },
        },
      });
      createdObj++;
      createdKR += obj.krs.length;
    } catch (e) {
      errors.push(`Objective "${obj.title}": ${String(e)}`);
    }
  }

  return Response.json({
    success: true,
    message: `Berhasil mengimpor ${createdObj} objective dan ${createdKR} key result.`,
    created: { objectives: createdObj, keyResults: createdKR },
    debug: { rowsParsed: rows.length, skipped: skipped.length > 0 ? skipped : undefined },
    errors: errors.length > 0 ? errors : undefined,
  });
}
