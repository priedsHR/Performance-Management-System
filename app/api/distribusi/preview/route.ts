import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

function readStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("").replace(/[\r\n]+/g, " ").trim();
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    return r == null ? "" : String(r).replace(/[\r\n]+/g, " ").trim();
  }
  if (v instanceof Date) return "";
  return String(v).replace(/[\r\n]+/g, " ").trim();
}

function readNum(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    return r == null ? "" : String(r);
  }
  return String(v);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const quarterIdFromUrl = searchParams.get("quarterId") || null;
  const leadIdFromUrl = searchParams.get("leadId") || null;

  const formData = await req.formData();
  const file = formData.get("file");
  const leadId = leadIdFromUrl ?? (formData.get("leadId") as string) ?? session.user.id;

  if (!file || typeof file === "string") return Response.json({ error: "No file provided." }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await (file as File).arrayBuffer()); } catch {
    return Response.json({ error: "Invalid file." }, { status: 400 });
  }

  const sheetNames = wb.worksheets.map((ws) => ws.name);
  let sheet: ExcelJS.Worksheet | undefined = wb.getWorksheet("Distribusi");
  if (!sheet) {
    for (const ws of wb.worksheets) {
      if (!/petunjuk/i.test(ws.name)) { sheet = ws; break; }
    }
  }
  if (!sheet) return Response.json({ sheetNames, error: "Sheet Distribusi not found." }, { status: 400 });

  // DB state for comparison — quarter comes from URL param (most reliable for multipart POST)
  const activeQuarter = quarterIdFromUrl
    ? await prisma.quarter.findUnique({ where: { id: quarterIdFromUrl } })
    : await prisma.quarter.findFirst({ where: { isActive: true } });
  const objectives = activeQuarter ? await prisma.objective.findMany({
    where: { userId: leadId, quarterId: activeQuarter.id },
    include: { keyResults: true },
  }) : [];

  const dbObjTitles = objectives.map((o) => o.title);
  const dbKRTitles = objectives.flatMap((o) => o.keyResults.map((kr) => kr.title));

  // Read rows
  const maxRow = sheet.rowCount;
  const rows = [];
  for (let r = 1; r <= Math.min(maxRow, 30); r++) {
    const row = sheet.getRow(r);
    rows.push({
      r,
      A: readStr(row.getCell(1)),
      B: readStr(row.getCell(2)),
      C: readNum(row.getCell(3)),
      D: readStr(row.getCell(4)),
      E: readNum(row.getCell(5)),
      F: readStr(row.getCell(6)),
      G: readNum(row.getCell(7)),
    });
  }

  // Check which objective/KR titles from file match DB
  const norm = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().toLowerCase();
  const dataRows = rows.filter((r) => r.r >= 3 && r.D);
  const fileObjTitles = [...new Set(dataRows.map((r) => r.B).filter(Boolean))];
  const fileKRTitles = [...new Set(dataRows.map((r) => r.D).filter(Boolean))];

  const objMatches = fileObjTitles.map((t) => ({
    title: t,
    matched: dbObjTitles.some((d) => norm(d) === norm(t)),
    dbTitle: dbObjTitles.find((d) => norm(d) === norm(t)) ?? null,
  }));
  const krMatches = fileKRTitles.map((t) => ({
    title: t,
    matched: dbKRTitles.some((d) => norm(d) === norm(t)),
  }));

  // If nothing matches, search all quarters to help the user find the right one
  const noneMatch = objMatches.length > 0 && objMatches.every((o) => !o.matched);
  let quarterHint: string | null = null;
  if (noneMatch) {
    const allObjs = await prisma.objective.findMany({
      where: { userId: leadId },
      select: { title: true, quarterId: true },
    });
    const fileNorms = fileObjTitles.map((t) => norm(t));
    const foundQuarterIds = new Set<string>();
    for (const obj of allObjs) {
      const objNorm = norm(obj.title);
      if (fileNorms.some((fn) => fn === objNorm || fn.includes(objNorm) || objNorm.includes(fn))) {
        foundQuarterIds.add(obj.quarterId);
      }
    }
    if (foundQuarterIds.size > 0) {
      const quarters = await prisma.quarter.findMany({
        where: { id: { in: [...foundQuarterIds] } },
        select: { name: true },
      });
      quarterHint = `The objectives in the file belong to quarter: ${quarters.map((q) => q.name).join(", ")}. Switch to that quarter before importing.`;
    }
  }

  return Response.json({
    sheetNames,
    selectedSheet: sheet.name,
    selectedQuarter: activeQuarter?.name ?? null,
    maxRow,
    rows,
    matching: { objectives: objMatches, keyResults: krMatches },
    db: { objectives: dbObjTitles, keyResults: dbKRTitles },
    quarterHint,
  });
}
