import { auth } from "@/auth";
import ExcelJS from "exceljs";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";
  wb.created = new Date();

  // ── Sheet 1: Petunjuk ────────────────────────────────────────────────────────
  const info = wb.addWorksheet("Petunjuk");
  info.getColumn("A").width = 28;
  info.getColumn("B").width = 72;

  const title = info.getCell("A1");
  title.value = "Panduan Pengisian Template OKR";
  title.font = { name: "Arial", bold: true, size: 14, color: { argb: "FF1E293B" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBBF24" } };
  title.alignment = { vertical: "middle" };
  info.getRow(1).height = 32;

  const guide: [string, string][] = [
    ["", ""],
    ["CARA PENGGUNAAN", ""],
    ["1.", 'Buka sheet "OKR" (tab di bawah)'],
    ["2.", "Isi data mulai dari baris ke-3 (setelah baris header)"],
    ["3.", "Satu objective bisa punya banyak Key Result. Tulis nama Objective hanya di baris pertama KR-nya. Baris KR berikutnya di objective yang sama: kosongkan kolom A & B."],
    ["4.", "Total Bobot Objective (%) harus = 100"],
    ["5.", "Total Bobot KR (%) per objective harus = 100"],
    ["6.", "Simpan file lalu upload via tombol Import di halaman OKR"],
    ["", ""],
    ["KETERANGAN KOLOM", ""],
    ["A  Objective", "Nama objective (isi hanya di baris pertama KR tiap objective)"],
    ["B  Bobot Objective (%)", "Bobot objective, total semua = 100 (isi hanya di baris pertama)"],
    ["C  Key Result", "Nama key result — WAJIB diisi setiap baris"],
    ["D  Target", "Angka target (wajib, angka saja)"],
    ["E  Satuan", "Satuan: %, pcs, x, score, hari, bulan, orang, lainnya"],
    ["F  Bobot KR (%)", "Bobot KR, total per objective = 100"],
    ["", ""],
    ["CONTOH", ""],
    ["Baris 3:", "A=Meningkatkan Revenue, B=60, C=Target Revenue Q1, D=500, E=juta, F=100"],
    ["Baris 4:", "A=(kosong), B=(kosong), C=Ini salah — KR kedua dalam obj sama harusnya di objective yang sama"],
    ["", ""],
    ["ATURAN PENTING", ""],
    ["*", "Jangan ubah atau hapus baris header (baris 1 dan 2) di sheet OKR"],
    ["*", "Kolom C (Key Result) harus selalu diisi"],
    ["*", "Baris yang kolom C-nya kosong akan diabaikan"],
    ["*", "Objective yang sudah Terkumpul tidak akan dihapus, hanya yang masih Draft"],
  ];

  let r = 2;
  for (const [a, b] of guide) {
    const row = info.getRow(r);
    if (a === "CARA PENGGUNAAN" || a === "KETERANGAN KOLOM" || a === "CONTOH" || a === "ATURAN PENTING") {
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

  const headers = ["Objective", "Bobot Objective (%)", "Key Result", "Target", "Satuan", "Bobot KR (%)"];
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
    "CONTOH: Meningkatkan Revenue",
    "60",
    "CONTOH: Capai Revenue Q1 500 juta",
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
