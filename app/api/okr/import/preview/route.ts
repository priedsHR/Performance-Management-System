import { auth } from "@/auth";
import ExcelJS from "exceljs";

function readCellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("").trim();
  if (typeof v === "object" && "result" in v) {
    const res = (v as ExcelJS.CellFormulaValue).result;
    return res === null || res === undefined ? "" : String(res).trim();
  }
  if (typeof v === "object" && "text" in v)
    return String((v as ExcelJS.CellHyperlinkValue).text ?? "").trim();
  if (v instanceof Date) return "";
  return String(v).trim();
}

function readCellRaw(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "(empty)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let fileBuffer: ArrayBuffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return Response.json({ error: "File not found." }, { status: 400 });
    fileBuffer = await (file as File).arrayBuffer();
  } catch {
    return Response.json({ error: "Failed to read the file." }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(fileBuffer); } catch {
    return Response.json({ error: "Invalid Excel file." }, { status: 400 });
  }

  const sheetNames = wb.worksheets.map(ws => ws.name);
  let sheet: ExcelJS.Worksheet | undefined = wb.getWorksheet("OKR");
  if (!sheet) {
    for (const ws of wb.worksheets) {
      if (!/petunjuk/i.test(ws.name)) { sheet = ws; break; }
    }
  }

  if (!sheet) return Response.json({ sheetNames, error: "Sheet OKR not found" });

  const maxRow = sheet.rowCount;
  const rawRows: Record<string, string>[] = [];

  // Dump first 20 rows raw
  for (let rowNum = 1; rowNum <= Math.min(maxRow, 20); rowNum++) {
    const row = sheet.getRow(rowNum);
    rawRows.push({
      rowNum: String(rowNum),
      A: readCellRaw(row.getCell(1)),
      B: readCellRaw(row.getCell(2)),
      C: readCellRaw(row.getCell(3)),
      D: readCellRaw(row.getCell(4)),
      E: readCellRaw(row.getCell(5)),
      F: readCellRaw(row.getCell(6)),
      A_str: readCellString(row.getCell(1)),
      C_str: readCellString(row.getCell(3)),
    });
  }

  return Response.json({ sheetNames, selectedSheet: sheet.name, maxRow, rawRows });
}
