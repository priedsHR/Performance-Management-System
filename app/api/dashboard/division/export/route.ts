import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcObjectiveAchievement, calcMemberAchievement, aggregateKRProgress } from "@/lib/calculations";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["LEAD", "ADMIN", "MEMBER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarterId");

  let leadId = searchParams.get("leadId") ?? session.user.id;
  if (session.user.role === "MEMBER") {
    if (!session.user.division) return NextResponse.json({ error: "Division not found." }, { status: 404 });
    const lead = await prisma.user.findFirst({ where: { role: "LEAD", division: session.user.division }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: "Division lead not found." }, { status: 404 });
    leadId = lead.id;
  }
  const divisionName = searchParams.get("divisionName") ?? "Division";

  if (!quarterId) return NextResponse.json({ error: "quarterId required" }, { status: 400 });

  const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
  const objectivesRaw = await prisma.objective.findMany({
    where: { userId: leadId, quarterId },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });
  const members = await prisma.teamMember.findMany({
    where: { leadId },
    include: { assignments: { include: { krAssignments: true } } },
    orderBy: { name: "asc" },
  });

  const allKRAssignments = members.flatMap((m) => m.assignments.flatMap((a) => a.krAssignments));
  const objectives = aggregateKRProgress(objectivesRaw, allKRAssignments);

  const memberAchievements = members
    .map((m) => ({ name: m.name, achievement: calcMemberAchievement(m.assignments, objectives) }))
    .sort((a, b) => b.achievement - a.achievement);

  const totalW = objectives.reduce((s, o) => s + o.weight, 0);
  const divisionAchievement = totalW > 0
    ? objectives.reduce((s, o) => s + (calcObjectiveAchievement(o) * o.weight) / totalW, 0)
    : 0;

  // ── Build Excel ──────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";
  wb.created = new Date();

  // Sheet 1: Ringkasan
  const ws1 = wb.addWorksheet("Ringkasan");
  ws1.columns = [{ key: "label", width: 28 }, { key: "value", width: 36 }];
  ws1.addRows([
    { label: "Division", value: divisionName },
    { label: "Quarter", value: quarter?.name ?? quarterId },
    { label: "Export Date", value: new Date().toLocaleDateString("id-ID") },
    { label: "Division Achievement (%)", value: parseFloat(divisionAchievement.toFixed(1)) },
    { label: "Jumlah Objective", value: objectives.length },
    { label: "Member Count", value: members.length },
  ]);
  ws1.getRow(1).font = { bold: true };

  // Sheet 2: OKR Detail
  const ws2 = wb.addWorksheet("OKR Detail");
  ws2.columns = [
    { header: "Objective", key: "objective", width: 38 },
    { header: "Obj Weight (%)", key: "objWeight", width: 14 },
    { header: "Obj Achievement (%)", key: "objAch", width: 18 },
    { header: "Key Result", key: "kr", width: 38 },
    { header: "KR Weight (%)", key: "krWeight", width: 13 },
    { header: "Target", key: "target", width: 10 },
    { header: "Satuan", key: "unit", width: 10 },
    { header: "Progress Tim", key: "teamProgress", width: 13 },
    { header: "Kontribusi Lead", key: "leadProgress", width: 15 },
    { header: "Total Progress", key: "totalProgress", width: 13 },
    { header: "KR Achievement (%)", key: "krAch", width: 17 },
  ];
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };

  for (const obj of objectives) {
    const objAch = calcObjectiveAchievement(obj);
    for (const kr of obj.keyResults) {
      const totalProgress = kr.teamProgress + (kr.leadProgress ?? 0);
      const krAch = kr.target > 0 ? Math.min((totalProgress / kr.target) * 100, 100) : 0;
      ws2.addRow({
        objective: obj.title,
        objWeight: obj.weight,
        objAch: parseFloat(objAch.toFixed(1)),
        kr: kr.title,
        krWeight: kr.weight,
        target: kr.target,
        unit: kr.unit,
        teamProgress: kr.teamProgress,
        leadProgress: kr.leadProgress ?? 0,
        totalProgress,
        krAch: parseFloat(krAch.toFixed(1)),
      });
    }
  }

  // Sheet 3: Member Ranking
  const ws3 = wb.addWorksheet("Member Ranking");
  ws3.columns = [
    { header: "Peringkat", key: "rank", width: 10 },
    { header: "Member Name", key: "name", width: 30 },
    { header: "Achievement (%)", key: "achievement", width: 16 },
  ];
  ws3.getRow(1).font = { bold: true };
  ws3.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
  memberAchievements.forEach((m, i) => {
    ws3.addRow({ rank: i + 1, name: m.name, achievement: parseFloat(m.achievement.toFixed(1)) });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `division-dashboard-${(quarter?.name ?? quarterId).replace(/\s+/g, "-")}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
