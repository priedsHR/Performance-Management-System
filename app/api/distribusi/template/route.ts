import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role === "MEMBER") return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId") ?? session.user.id;
  const quarterIdParam = searchParams.get("quarterId");

  const activeQuarter = quarterIdParam
    ? await prisma.quarter.findUnique({ where: { id: quarterIdParam } })
    : await prisma.quarter.findFirst({ where: { isActive: true } });
  const objectives = activeQuarter
    ? await prisma.objective.findMany({
        where: { userId: leadId, quarterId: activeQuarter.id },
        include: { keyResults: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Fetch existing members
  const members = await prisma.teamMember.findMany({
    where: { leadId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Fetch existing assignment weights to pre-fill columns C and G
  const objIds = objectives.map((o) => o.id);
  const memberIds = members.map((m) => m.id);
  const existingAssignments = objIds.length > 0 && memberIds.length > 0
    ? await prisma.objectiveAssignment.findMany({
        where: { memberId: { in: memberIds }, objectiveId: { in: objIds } },
        include: { krAssignments: { select: { keyResultId: true, weight: true } } },
      })
    : [];
  const objWeightMap = new Map<string, number>(
    existingAssignments.map((a) => [`${a.memberId}::${a.objectiveId}`, a.weight])
  );
  const kraWeightMap = new Map<string, number>(
    existingAssignments.flatMap((a) =>
      a.krAssignments.map((kra) => [`${a.memberId}::${a.objectiveId}::${kra.keyResultId}`, kra.weight])
    )
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";

  // ── Petunjuk sheet ────────────────────────────────────────────────────────────
  const info = wb.addWorksheet("📋 Petunjuk");
  info.getColumn("A").width = 28;
  info.getColumn("B").width = 72;

  const titleCell = info.getCell("A1");
  titleCell.value = "📋 Panduan Pengisian Distribusi Anggota";
  titleCell.font = { name: "Arial", bold: true, size: 13, color: { argb: "FF1E293B" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBBF24" } };
  titleCell.alignment = { vertical: "middle" };
  info.getRow(1).height = 30;

  const guide: [string, string][] = [
    ["", ""],
    ["📌 CARA PENGGUNAAN", ""],
    ["1.", 'Buka sheet "Distribusi" (tab di bawah)'],
    ["2.", "Kolom A (Anggota) sudah diisi daftar anggota yang ada. Tambahkan nama baru jika perlu."],
    ["3.", "Kolom B (Objective) & D (Key Result) sudah diisi dari data OKR yang ada — jangan diubah"],
    ["4.", "Isi Bobot Objective (%) per anggota — total per anggota harus = 100"],
    ["5.", "Isi Target Individu jika berbeda dari target divisi (kosongkan = pakai target divisi)"],
    ["6.", "Isi Bobot KR (%) — total per objective per anggota harus = 100"],
    ["7.", "Upload file ini via tombol Import Distribusi di aplikasi"],
    ["", ""],
    ["📊 KETERANGAN KOLOM", ""],
    ["A  Anggota", "Nama anggota (harus persis sama dengan yang ada di daftar)"],
    ["B  Objective", "Nama objective (jangan diubah, dipakai untuk matching)"],
    ["C  Bobot Objective (%)", "Bobot objective untuk anggota ini (total per anggota = 100)"],
    ["D  Key Result", "Nama key result (jangan diubah)"],
    ["E  Target Individu", "Target khusus anggota ini (kosong = ikut target divisi)"],
    ["F  Satuan", "Otomatis dari divisi (tidak perlu diubah)"],
    ["G  Bobot KR (%)", "Bobot KR dalam objective anggota ini (total per objective = 100)"],
    ["", ""],
    ["⚠️ ATURAN PENTING", ""],
    ["•", "Import akan MENGGANTIKAN semua assignment yang ada"],
    ["•", "Baris dengan kolom A (Anggota) kosong akan menggunakan anggota dari baris sebelumnya"],
    ["•", "Baris dengan kolom D (Key Result) kosong akan diabaikan"],
    ["•", "Anggota baru (tidak ada di daftar) akan dibuat otomatis"],
  ];

  let r = 2;
  for (const [a, b] of guide) {
    const row = info.getRow(r);
    if (a.startsWith("📌") || a.startsWith("📊") || a.startsWith("⚠️")) {
      row.getCell(1).value = a;
      row.getCell(1).font = { name: "Arial", bold: true, size: 11, color: { argb: "FFB45309" } };
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

  // ── Distribusi sheet ──────────────────────────────────────────────────────────
  const sheet = wb.addWorksheet("Distribusi", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 2 }],
  });

  const AMBER = "FFFBBF24";
  const DARK = "FF1E293B";

  // Header row 1
  const headers = ["Anggota", "Objective", "Bobot Objective (%)", "Key Result", "Target Individu", "Satuan", "Bobot KR (%)"];
  const hRow = sheet.getRow(1);
  hRow.height = 28;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 11, color: { argb: DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium", color: { argb: "FFD97706" } } };
  });

  // Note row 2
  sheet.mergeCells("A2:G2");
  const noteCell = sheet.getCell("A2");
  noteCell.value = "ℹ️  Kolom B, C, D, F sudah diisi dari data OKR. Kolom A wajib diisi. Kolom E & G wajib diisi. Kosongkan Target Individu (E) jika sama dengan target divisi.";
  noteCell.font = { name: "Arial", italic: true, size: 10, color: { argb: "FF64748B" } };
  noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  noteCell.alignment = { vertical: "middle" };
  sheet.getRow(2).height = 22;

  // Pre-fill data rows — grouped by member → objective → KR for clean import carry-forward
  let rowIdx = 3;
  const PREFILL_BG = "FFEFF6FF"; // light blue — pre-filled from DB, do not change
  const INPUT_BG   = "FFFFFBEB"; // light amber — cells user fills in

  const memberList = members.length > 0 ? members : [{ id: "", name: "" }];

  if (objectives.length > 0) {
    for (const member of memberList) {
      for (const obj of objectives) {
        const existingObjWeight = member.id ? (objWeightMap.get(`${member.id}::${obj.id}`) ?? null) : null;
        let firstKrRow = true;

        for (const kr of obj.keyResults) {
          const dataRow = sheet.getRow(rowIdx);
          dataRow.height = 20;

          // A: Member name (mandatory — always filled so import never loses track)
          const cellA = dataRow.getCell(1);
          cellA.value = member.name || null;
          cellA.font = { name: "Arial", size: 10, bold: true };
          cellA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_BG } };
          cellA.alignment = { vertical: "middle" };

          // B: Objective — pre-filled, do not change (used for matching)
          const cellB = dataRow.getCell(2);
          cellB.value = obj.title;
          cellB.font = { name: "Arial", size: 10, color: { argb: "FF374151" } };
          cellB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PREFILL_BG } };
          cellB.alignment = { vertical: "middle", wrapText: false };

          // C: Bobot Objective — pre-filled from existing assignment; only on first KR row per obj-member
          const cellC = dataRow.getCell(3);
          cellC.value = firstKrRow ? existingObjWeight : null;
          cellC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: firstKrRow ? INPUT_BG : "FFFAFAFA" } };
          cellC.font = { name: "Arial", size: 10 };
          cellC.alignment = { vertical: "middle", horizontal: "center" };
          if (!firstKrRow) cellC.font = { ...cellC.font, color: { argb: "FFCCCCCC" } };

          // D: KR title — pre-filled, do not change (used for matching)
          const cellD = dataRow.getCell(4);
          cellD.value = kr.title;
          cellD.font = { name: "Arial", size: 10, color: { argb: "FF374151" } };
          cellD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PREFILL_BG } };
          cellD.alignment = { vertical: "middle", wrapText: false };

          // E: Target individu — optional, blank = use division target
          const cellE = dataRow.getCell(5);
          cellE.value = null;
          cellE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_BG } };
          cellE.font = { name: "Arial", size: 10, color: { argb: "FF6B7280" } };
          cellE.alignment = { vertical: "middle", horizontal: "center" };
          cellE.note = `Target divisi: ${kr.target} ${kr.unit}\nKosongkan jika sama.`;

          // F: Unit — pre-filled for reference, import ignores this column
          const cellF = dataRow.getCell(6);
          cellF.value = kr.unit;
          cellF.font = { name: "Arial", size: 10, color: { argb: "FF94A3B8" } };
          cellF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PREFILL_BG } };
          cellF.alignment = { vertical: "middle", horizontal: "center" };

          // G: Bobot KR — pre-filled from existing assignment
          const existingKraWeight = member.id
            ? (kraWeightMap.get(`${member.id}::${obj.id}::${kr.id}`) ?? null)
            : null;
          const cellG = dataRow.getCell(7);
          cellG.value = existingKraWeight;
          cellG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_BG } };
          cellG.font = { name: "Arial", size: 10 };
          cellG.alignment = { vertical: "middle", horizontal: "center" };

          firstKrRow = false;
          rowIdx++;
        }
      }
    }
  } else {
    // No objectives yet — show empty template rows
    for (let i = 3; i <= 52; i++) {
      const row = sheet.getRow(i);
      row.height = 20;
      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: [2, 4, 6].includes(c) ? PREFILL_BG : INPUT_BG } };
        cell.font = { name: "Arial", size: 10 };
      }
    }
  }

  // Column widths
  [20, 36, 20, 36, 16, 10, 14].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-distribusi-okr.xlsx"',
    },
  });
}
