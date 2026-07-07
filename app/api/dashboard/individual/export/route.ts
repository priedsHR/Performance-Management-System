import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcMemberAchievement } from "@/lib/calculations";
import type { ObjWithKRs } from "@/lib/calculations";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["LEAD", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const quarterId = searchParams.get("quarterId");
  const leadId = searchParams.get("leadId") ?? session.user.id;

  if (!memberId || !quarterId) {
    return NextResponse.json({ error: "memberId and quarterId required" }, { status: 400 });
  }

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member || member.leadId !== leadId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
  const objectives = await prisma.objective.findMany({
    where: { userId: leadId, quarterId },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });

  const objMap = new Map<string, ObjWithKRs>(
    objectives.map((o) => [o.id, {
      id: o.id, title: o.title, weight: o.weight,
      keyResults: o.keyResults.map((kr) => ({
        id: kr.id, title: kr.title, target: kr.target, unit: kr.unit,
        weight: kr.weight, teamProgress: kr.teamProgress, leadProgress: kr.leadProgress,
      })),
    }])
  );

  const assignments = await prisma.objectiveAssignment.findMany({
    where: { memberId, objective: { userId: leadId, quarterId } },
    include: { krAssignments: true },
  });

  const calcAssignments = assignments.map((a) => ({
    weight: a.weight, objectiveId: a.objectiveId,
    krAssignments: a.krAssignments.map((kra) => ({
      keyResultId: kra.keyResultId, weight: kra.weight, progress: kra.progress, target: kra.target,
    })),
  }));

  const achievement = calcMemberAchievement(calcAssignments, Array.from(objMap.values()));

  // ── Build Excel ──────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";
  wb.created = new Date();

  // Sheet 1: Ringkasan
  const ws1 = wb.addWorksheet("Summary");
  ws1.columns = [{ key: "label", width: 28 }, { key: "value", width: 36 }];
  ws1.addRows([
    { label: "Member Name", value: member.name },
    { label: "Quarter", value: quarter?.name ?? quarterId },
    { label: "Export Date", value: new Date().toLocaleDateString("id-ID") },
    { label: "Total Achievement (%)", value: parseFloat(achievement.toFixed(1)) },
    { label: "Objective Count", value: assignments.length },
  ]);
  ws1.getRow(1).font = { bold: true };

  // Sheet 2: KR Detail
  const ws2 = wb.addWorksheet("KR Detail");
  ws2.columns = [
    { header: "Objective", key: "objective", width: 38 },
    { header: "Obj Weight (%)", key: "objWeight", width: 14 },
    { header: "Key Result", key: "kr", width: 38 },
    { header: "KR Weight (%)", key: "krWeight", width: 13 },
    { header: "Target", key: "target", width: 10 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Individual Target", key: "individualTarget", width: 15 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Achievement (%)", key: "krAch", width: 15 },
  ];
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };

  for (const a of assignments) {
    const obj = objMap.get(a.objectiveId);
    if (!obj) continue;
    for (const kra of a.krAssignments) {
      const kr = obj.keyResults.find((k) => k.id === kra.keyResultId);
      const effectiveTarget = (kra.target != null && kra.target > 0) ? kra.target : (kr?.target ?? 0);
      const krAch = effectiveTarget > 0 ? Math.min((kra.progress / effectiveTarget) * 100, 100) : 0;
      ws2.addRow({
        objective: obj.title,
        objWeight: a.weight,
        kr: kr?.title ?? "—",
        krWeight: kra.weight,
        target: kr?.target ?? 0,
        unit: kr?.unit ?? "",
        individualTarget: kra.target ?? "-",
        progress: kra.progress,
        krAch: parseFloat(krAch.toFixed(1)),
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `dashboard-${member.name.replace(/\s+/g, "-")}-${(quarter?.name ?? quarterId).replace(/\s+/g, "-")}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
