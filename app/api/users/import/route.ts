import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["ADMIN", "LEAD", "MEMBER"];

function readStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    return r == null ? "" : String(r);
  }
  // Hyperlink cell: { text: "...", hyperlink: "mailto:..." }
  if (typeof v === "object" && "text" in v)
    return String((v as { text: unknown }).text);
  return String(v);
}

export async function GET() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";

  const sheet = wb.addWorksheet("Pengguna", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  const AMBER = "FFFBBF24";
  const DARK = "FF1E293B";

  const headers = [
    "Nama*",
    "Email*",
    "Password*",
    "Role (ADMIN/LEAD/MEMBER)*",
    "Divisi",
  ];
  const hRow = sheet.getRow(1);
  hRow.height = 26;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 11, color: { argb: DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const examples = [
    ["Budi Santoso", "budi@perusahaan.com", "Password123!", "MEMBER", "Finance"],
    ["Siti Rahayu", "siti@perusahaan.com", "Password123!", "LEAD", "Finance"],
    ["Andi Wijaya", "andi@perusahaan.com", "Password123!", "MEMBER", "HR"],
  ];
  examples.forEach((row, i) => {
    const r = sheet.getRow(i + 2);
    row.forEach((val, j) => { r.getCell(j + 1).value = val; });
    r.height = 20;
  });

  // Note row
  const noteRow = sheet.getRow(6);
  noteRow.getCell(1).value = "Catatan: Jika email sudah ada, data akan diperbarui kecuali password (kosongkan kolom password untuk tidak mengubah password).";
  noteRow.getCell(1).font = { name: "Arial", italic: true, size: 10, color: { argb: "FF94A3B8" } };
  sheet.mergeCells("A6:E6");

  [28, 28, 20, 26, 24].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-pengguna.xlsx"',
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
      return Response.json({ error: "File tidak ditemukan." }, { status: 400 });
    fileBuffer = await (file as File).arrayBuffer();
  } catch {
    return Response.json({ error: "Gagal membaca form." }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(fileBuffer); } catch {
    return Response.json({ error: "File Excel tidak valid." }, { status: 400 });
  }

  const sheet = wb.getWorksheet("Pengguna") ?? wb.worksheets[0];
  if (!sheet) return Response.json({ error: "Sheet tidak ditemukan." }, { status: 400 });

  let created = 0, updated = 0;
  const errors: string[] = [];
  const linkLog: string[] = [];

  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const name = readStr(row.getCell(1)).trim();
    const email = readStr(row.getCell(2)).trim().toLowerCase();
    const password = readStr(row.getCell(3)).trim();
    const roleRaw = readStr(row.getCell(4)).trim().toUpperCase();
    const division = readStr(row.getCell(5)).trim() || null;

    // Skip empty rows and note rows (e.g. "Catatan: ...")
    if (!name && !email) continue;
    if (!email.includes("@")) {
      if (name.startsWith("Catatan") || name.startsWith("Note") || !name) continue;
      errors.push(`Baris ${rowNum} "${name}": Email tidak valid (harus format xxx@domain.com).`);
      continue;
    }
    if (!name) { errors.push(`Baris ${rowNum}: Nama kosong, dilewati.`); continue; }

    const role = VALID_ROLES.includes(roleRaw) ? roleRaw : "MEMBER";

    try {
      let userId: string;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        const data: Record<string, unknown> = { name, role, division };
        if (password) data.password = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { email }, data });
        userId = existing.id;
        updated++;
      } else {
        if (!password) { errors.push(`Baris ${rowNum} "${name}": Password wajib untuk pengguna baru.`); continue; }
        const hashed = await bcrypt.hash(password, 10);
        const created_user = await prisma.user.create({ data: { name, email, password: hashed, role: role as "ADMIN" | "LEAD" | "MEMBER", division } });
        userId = created_user.id;
        created++;
      }

      // Auto-link MEMBER to matching TeamMember (same division, name match)
      if (role === "MEMBER" && division) {
        const alreadyLinked = await prisma.teamMember.findUnique({ where: { userId } });
        if (alreadyLinked) {
          linkLog.push(`${name}: sudah ter-link ke "${alreadyLinked.name}"`);
        } else {
          const pool = await prisma.teamMember.findMany({
            include: { lead: { select: { division: true } } },
          });
          const unlinkedInDiv = pool.filter(
            (tm) => tm.userId === null && tm.lead.division?.toLowerCase() === division.toLowerCase()
          );
          linkLog.push(`${name}: pool=${pool.length}, inDiv=${unlinkedInDiv.length} [${unlinkedInDiv.map(t => t.name).join(", ")}]`);

          const nameLower = name.toLowerCase();
          const match =
            unlinkedInDiv.find((tm) => tm.name.toLowerCase() === nameLower) ??
            (() => { const c = unlinkedInDiv.filter((tm) => tm.name.toLowerCase().startsWith(nameLower)); return c.length === 1 ? c[0] : undefined; })() ??
            (() => { const c = unlinkedInDiv.filter((tm) => nameLower.startsWith(tm.name.toLowerCase())); return c.length === 1 ? c[0] : undefined; })();

          if (match) {
            await prisma.teamMember.update({ where: { id: match.id }, data: { userId } });
            linkLog.push(`${name}: ✅ linked ke "${match.name}"`);
          } else {
            linkLog.push(`${name}: ❌ no match found`);
          }
        }
      }
    } catch (e) {
      errors.push(`Baris ${rowNum} "${name}": ${String(e)}`);
    }
  }

  return Response.json({
    success: true,
    message: `Berhasil: ${created} akun baru dibuat, ${updated} akun diperbarui.`,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
    linkLog,
  });
}
