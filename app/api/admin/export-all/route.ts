import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcObjectiveAchievement, calcMemberAchievement, aggregateKRProgress } from "@/lib/calculations";
import ExcelJS from "exceljs";

const AMBER = "FFFEF3C7";
const HEADER_FONT = { bold: true, name: "Arial", size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };

function achFill(v: number): ExcelJS.Fill {
  const argb = v >= 90 ? "FFD1FAE5" : v >= 70 ? "FFFEF3C7" : "FFFEE2E2";
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarterId");
  if (!quarterId) return new Response("quarterId required", { status: 400 });

  const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
  if (!quarter) return new Response("Quarter not found", { status: 404 });

  // Fetch all LEAD users
  const leads = await prisma.user.findMany({
    where: { role: "LEAD" },
    select: { id: true, name: true, division: true },
    orderBy: { division: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "OKR App";
  wb.created = new Date();

  // ── Summary sheet ────────────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet("📋 Ringkasan");
  wsSummary.columns = [
    { header: "Division", key: "division", width: 22 },
    { header: "Lead", key: "lead", width: 24 },
    { header: "Objectives", key: "objectives", width: 12 },
    { header: "Member", key: "members", width: 10 },
    { header: "Achievement (%)", key: "achievement", width: 16 },
  ];
  const sumHeaderRow = wsSummary.getRow(1);
  sumHeaderRow.font = HEADER_FONT;
  sumHeaderRow.fill = HEADER_FILL;
  sumHeaderRow.alignment = { horizontal: "center" };

  const divisionSummaries: { division: string; lead: string; objectives: number; members: number; achievement: number }[] = [];

  // ── Per-division sheets ───────────────────────────────────────────────────────
  for (const lead of leads) {
    const divisionName = lead.division ?? lead.name;
    const sheetName = divisionName.slice(0, 31); // Excel tab max 31 chars

    const objectivesRaw = await prisma.objective.findMany({
      where: { userId: lead.id, quarterId },
      include: { keyResults: true },
      orderBy: { createdAt: "asc" },
    });

    // Query for calculations (needs full objective shape)
    const members = await prisma.teamMember.findMany({
      where: { leadId: lead.id },
      include: { assignments: { include: { krAssignments: true } } },
      orderBy: { name: "asc" },
    });

    // Query for per-member detail section (needs KR + objective titles)
    const membersDetail = await prisma.teamMember.findMany({
      where: { leadId: lead.id },
      include: {
        assignments: {
          include: {
            objective: { select: { title: true } },
            krAssignments: {
              include: { keyResult: { select: { title: true, unit: true, target: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const allKRA = members.flatMap((m) => m.assignments.flatMap((a) => a.krAssignments));
    const objectives = aggregateKRProgress(objectivesRaw, allKRA);

    const totalW = objectives.reduce((s, o) => s + o.weight, 0);
    const divAch = totalW > 0
      ? objectives.reduce((s, o) => s + (calcObjectiveAchievement(o) * o.weight) / totalW, 0)
      : 0;

    const memberAchs = members
      .map((m) => ({ name: m.name, achievement: calcMemberAchievement(m.assignments, objectives) }))
      .sort((a, b) => b.achievement - a.achievement);

    divisionSummaries.push({
      division: divisionName,
      lead: lead.name,
      objectives: objectives.length,
      members: members.length,
      achievement: parseFloat(divAch.toFixed(1)),
    });

    if (objectives.length === 0) {
      // Still add the sheet but mark as empty
      const ws = wb.addWorksheet(sheetName);
      ws.addRow([`${divisionName} — no OKRs in this quarter yet`]);
      continue;
    }

    const ws = wb.addWorksheet(sheetName);

    // Division info rows
    ws.addRow(["Division", divisionName]);
    ws.addRow(["Lead", lead.name]);
    ws.addRow(["Quarter", quarter.name]);
    ws.addRow(["Division Achievement (%)", parseFloat(divAch.toFixed(1))]);
    ws.addRow([]);

    // OKR detail header
    const cols = [
      { header: "Objective", key: "objective", width: 36 },
      { header: "Obj Weight (%)", key: "objWeight", width: 14 },
      { header: "Obj Achievement (%)", key: "objAch", width: 16 },
      { header: "Key Result", key: "kr", width: 36 },
      { header: "KR Weight (%)", key: "krWeight", width: 13 },
      { header: "Target", key: "target", width: 10 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Progress", key: "totalProgress", width: 12 },
      { header: "KR Achievement (%)", key: "krAch", width: 15 },
    ];
    ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));

    const headerRow = ws.addRow(cols.map((c) => c.header));
    headerRow.font = HEADER_FONT;
    headerRow.fill = HEADER_FILL;

    for (const obj of objectives) {
      const objAch = calcObjectiveAchievement(obj);
      for (let i = 0; i < obj.keyResults.length; i++) {
        const kr = obj.keyResults[i];
        const totalProgress = kr.teamProgress + (kr.leadProgress ?? 0);
        const krAch = kr.target > 0 ? Math.min((totalProgress / kr.target) * 100, 100) : 0;
        const row = ws.addRow({
          objective: i === 0 ? obj.title : "",
          objWeight: i === 0 ? obj.weight : "",
          objAch: i === 0 ? parseFloat(objAch.toFixed(1)) : "",
          kr: kr.title,
          krWeight: kr.weight,
          target: kr.target,
          unit: kr.unit,
          totalProgress: parseFloat(totalProgress.toFixed(2)),
          krAch: parseFloat(krAch.toFixed(1)),
        });
        if (i === 0) {
          const achCell = row.getCell("objAch");
          achCell.fill = achFill(objAch);
        }
        const krAchCell = row.getCell("krAch");
        krAchCell.fill = achFill(krAch);
      }
      if (obj.keyResults.length === 0) {
        ws.addRow({ objective: obj.title, objWeight: obj.weight, objAch: parseFloat(objAch.toFixed(1)) });
      }
    }

    // Member ranking
    if (memberAchs.length > 0) {
      ws.addRow([]);
      const rankHeader = ws.addRow(["Rank", "Member Name", "Achievement (%)"]);
      rankHeader.font = HEADER_FONT;
      rankHeader.fill = HEADER_FILL;
      memberAchs.forEach((m, i) => {
        const row = ws.addRow([i + 1, m.name, parseFloat(m.achievement.toFixed(1))]);
        row.getCell(3).fill = achFill(m.achievement);
      });
    }

    // ── Detail OKR per anggota ──────────────────────────────────────────────
    if (membersDetail.length > 0) {
      ws.addRow([]);
      const sectionTitle = ws.addRow(["OKR Detail per Member"]);
      sectionTitle.font = { bold: true, name: "Arial", size: 11 };

      for (const member of membersDetail) {
        const memberAch = calcMemberAchievement(
          members.find((m) => m.id === member.id)?.assignments ?? [],
          objectives
        );
        ws.addRow([]);

        // Member name row
        const memberRow = ws.addRow([`👤 ${member.name}`, "", `Achievement: ${memberAch.toFixed(1)}%`]);
        memberRow.font = { bold: true, name: "Arial", size: 10, color: { argb: "FF1E293B" } };
        memberRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

        if (member.assignments.length === 0) {
          ws.addRow(["", "(No KR assignments yet)"]);
          continue;
        }

        // Column headers for this member
        const memberHeader = ws.addRow([
          "Objective", "Key Result", "Weight (%)", "Target", "Unit", "Progress", "Achievement (%)",
        ]);
        memberHeader.font = HEADER_FONT;
        memberHeader.fill = HEADER_FILL;

        for (const assignment of member.assignments) {
          if (!assignment.objective) continue;
          const objTitle = assignment.objective.title;
          for (let i = 0; i < assignment.krAssignments.length; i++) {
            const kra = assignment.krAssignments[i];
            const effectiveTarget = kra.target ?? kra.keyResult.target;
            const kraAch = effectiveTarget > 0
              ? Math.min((kra.progress / effectiveTarget) * 100, 100)
              : 0;
            const row = ws.addRow([
              i === 0 ? objTitle : "",
              kra.keyResult.title,
              kra.weight,
              effectiveTarget,
              kra.keyResult.unit,
              parseFloat(kra.progress.toFixed(2)),
              parseFloat(kraAch.toFixed(1)),
            ]);
            row.getCell(7).fill = achFill(kraAch);
          }
          if (assignment.krAssignments.length === 0) {
            ws.addRow([objTitle, "(No KRs)"]);
          }
        }
      }
    }
  }

  // Fill summary sheet
  divisionSummaries.forEach((d) => {
    const row = wsSummary.addRow(d);
    row.getCell("achievement").fill = achFill(d.achievement);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `OKR-All-Divisions-${quarter.name.replace(/\s+/g, "-")}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
