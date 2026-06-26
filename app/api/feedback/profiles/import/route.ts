import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import {
  ensureFeedbackBootstrap,
  getFeedbackSettings,
  resolveAutoCompetencyIds,
} from "@/lib/feedback/service";
import { DEPARTMENTS, LEVELS } from "@/lib/feedback/library";

function readStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    return r == null ? "" : String(r);
  }
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
  return String(v);
}

const HEADERS = [
  "Nama*",
  "Email*",
  "Password*",
  "Departemen",
  "Posisi",
  "Level",
  "Email Atasan",
  "Manager? (Ya/Tidak)",
];

export async function GET() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Performance Management System";
  const sheet = wb.addWorksheet("Karyawan", { views: [{ state: "frozen", ySplit: 1 }] });
  const TEAL = "FF2E7C8F";

  const hRow = sheet.getRow(1);
  hRow.height = 26;
  HEADERS.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const examples = [
    ["Vanessa Geraldine", "vanessa@perusahaan.com", "Password123!", "Commercial", "COO", "C-Suites", "", "Ya"],
    ["Lita Lestari", "lita@perusahaan.com", "Password123!", "Operations", "Finance Manager", "Manager", "vanessa@perusahaan.com", "Ya"],
    ["Tievanto Yasser", "tievanto@perusahaan.com", "Password123!", "Operations", "People & Culture", "Officer", "lita@perusahaan.com", "Tidak"],
  ];
  examples.forEach((row, i) => {
    const r = sheet.getRow(i + 2);
    row.forEach((val, j) => (r.getCell(j + 1).value = val));
    r.height = 20;
  });

  const note = sheet.getRow(6);
  note.getCell(1).value =
    "Catatan: Email Atasan harus cocok dengan Email karyawan lain di file ini (atau yang sudah ada). " +
    "Departemen menentukan rekan (peer); Atasan menentukan superordinate/subordinate. " +
    `Departemen yang dikenal: ${DEPARTMENTS.join(", ")}. Level: ${LEVELS.join(", ")}. ` +
    "Kompetensi diterapkan otomatis sesuai aturan; bisa disesuaikan per orang setelah impor.";
  note.getCell(1).font = { name: "Arial", italic: true, size: 10, color: { argb: "FF94A3B8" } };
  sheet.mergeCells("A6:H6");

  [24, 28, 18, 16, 22, 14, 26, 18].forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-karyawan-360.xlsx"',
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  await ensureFeedbackBootstrap();
  const settings = await getFeedbackSettings();

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
  try {
    await wb.xlsx.load(fileBuffer);
  } catch {
    return Response.json({ error: "File Excel tidak valid." }, { status: 400 });
  }
  const sheet = wb.getWorksheet("Karyawan") ?? wb.worksheets[0];
  if (!sheet) return Response.json({ error: "Sheet tidak ditemukan." }, { status: 400 });

  const allComps = await prisma.competency.findMany({
    select: { id: true, category: true, department: true, active: true },
  });

  let created = 0,
    updated = 0;
  const errors: string[] = [];
  const managerByEmail: { profileId: string; managerEmail: string; row: number }[] = [];
  const emailToUserId = new Map<string, string>();

  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const name = readStr(row.getCell(1)).trim();
    const email = readStr(row.getCell(2)).trim().toLowerCase();
    const password = readStr(row.getCell(3)).trim();
    const department = readStr(row.getCell(4)).trim() || null;
    const position = readStr(row.getCell(5)).trim() || null;
    const level = readStr(row.getCell(6)).trim() || null;
    const mgrEmail = readStr(row.getCell(7)).trim().toLowerCase();
    const isManager = /^(ya|yes|true|1)$/i.test(readStr(row.getCell(8)).trim());

    if (!name && !email) continue;
    if (!email.includes("@")) {
      if (name.startsWith("Catatan") || name.startsWith("Note") || !name) continue;
      errors.push(`Baris ${rowNum} "${name}": Email tidak valid.`);
      continue;
    }
    if (!name) {
      errors.push(`Baris ${rowNum}: Nama kosong, dilewati.`);
      continue;
    }

    try {
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        if (!password) {
          errors.push(`Baris ${rowNum} "${name}": Password wajib untuk karyawan baru.`);
          continue;
        }
        user = await prisma.user.create({
          data: { name, email, password: await bcrypt.hash(password, 10), role: "MEMBER", division: department },
        });
      } else {
        await prisma.user.update({ where: { id: user.id }, data: { name } });
      }
      emailToUserId.set(email, user.id);

      const targetLevel = level ? settings.levelTargets[level] ?? 1 : 1;
      let profile = await prisma.feedbackProfile.findUnique({ where: { userId: user.id } });
      if (profile) {
        profile = await prisma.feedbackProfile.update({
          where: { id: profile.id },
          data: { department, position, level, targetLevel, isManager, active: true },
        });
        updated++;
      } else {
        profile = await prisma.feedbackProfile.create({
          data: { userId: user.id, department, position, level, targetLevel, isManager, active: true },
        });
        created++;
      }

      // auto-apply competency rule (keeps existing manual technical picks intact: union)
      const autoIds = resolveAutoCompetencyIds({ department, isManager }, allComps);
      const existing = await prisma.profileCompetency.findMany({
        where: { profileId: profile.id },
        select: { competencyId: true },
      });
      const union = new Set([...existing.map((e) => e.competencyId), ...autoIds]);
      await prisma.profileCompetency.deleteMany({ where: { profileId: profile.id } });
      await prisma.profileCompetency.createMany({
        data: [...union].map((competencyId) => ({ profileId: profile!.id, competencyId })),
        skipDuplicates: true,
      });

      if (mgrEmail) managerByEmail.push({ profileId: profile.id, managerEmail: mgrEmail, row: rowNum });
    } catch (e) {
      errors.push(`Baris ${rowNum} "${name}": ${String(e)}`);
    }
  }

  // Second pass: resolve managers by email.
  for (const link of managerByEmail) {
    let mgrUserId = emailToUserId.get(link.managerEmail);
    if (!mgrUserId) {
      const u = await prisma.user.findUnique({ where: { email: link.managerEmail } });
      mgrUserId = u?.id;
    }
    if (mgrUserId) {
      await prisma.feedbackProfile.update({ where: { id: link.profileId }, data: { managerId: mgrUserId } });
    } else {
      errors.push(`Baris ${link.row}: Atasan dengan email "${link.managerEmail}" tidak ditemukan.`);
    }
  }

  return Response.json({
    success: true,
    message: `Berhasil: ${created} profil baru, ${updated} diperbarui.`,
    created,
    updated,
    errors: errors.length ? errors : undefined,
  });
}
