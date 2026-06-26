import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcObjectiveAchievement, calcMemberAchievement, aggregateKRProgress } from "@/lib/calculations";

function barFill(v: number) {
  return v >= 90 ? "#22c55e" : v >= 70 ? "#f59e0b" : "#f87171";
}

function ach(v: number) {
  if (v >= 100) return `<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:5px;font-weight:bold;">${v.toFixed(1)}%</span>`;
  if (v >= 70) return `<span style="background:#fef9c3;color:#b45309;padding:2px 8px;border-radius:5px;font-weight:bold;">${v.toFixed(1)}%</span>`;
  return `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:5px;font-weight:bold;">${v.toFixed(1)}%</span>`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["LEAD", "ADMIN", "MEMBER"].includes(session.user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const quarterId = searchParams.get("quarterId");

  let leadId = searchParams.get("leadId") ?? session.user.id;
  if (session.user.role === "MEMBER") {
    if (!session.user.division) return new Response("Division tidak ditemukan.", { status: 404 });
    const lead = await prisma.user.findFirst({ where: { role: "LEAD", division: session.user.division }, select: { id: true } });
    if (!lead) return new Response("Lead divisi tidak ditemukan.", { status: 404 });
    leadId = lead.id;
  }
  const divisionName = searchParams.get("divisionName") ?? "Divisi";

  if (!quarterId) return new Response("quarterId required", { status: 400 });

  const quarter = await prisma.quarter.findUnique({ where: { id: quarterId } });
  const objectivesRaw = await prisma.objective.findMany({
    where: { userId: leadId, quarterId },
    include: { keyResults: true },
    orderBy: { createdAt: "asc" },
  });

  const quarterObjectiveIds = objectivesRaw.map((o) => o.id);
  const members = await prisma.teamMember.findMany({
    where: { leadId },
    include: {
      assignments: {
        where: quarterObjectiveIds.length > 0 ? { objectiveId: { in: quarterObjectiveIds } } : { objectiveId: "___none___" },
        include: { krAssignments: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const allKRAssignments = members.flatMap((m) => m.assignments.flatMap((a) => a.krAssignments));
  const objectives = aggregateKRProgress(objectivesRaw, allKRAssignments);

  const totalW = objectives.reduce((s, o) => s + o.weight, 0);
  const divisionAchievement =
    totalW > 0 ? objectives.reduce((s, o) => s + (calcObjectiveAchievement(o) * o.weight) / totalW, 0) : 0;

  const memberAchievements = members
    .map((m) => ({ name: m.name, achievement: calcMemberAchievement(m.assignments, objectives) }))
    .sort((a, b) => b.achievement - a.achievement);

  // Build HTML
  let objRows = "";
  for (const obj of objectives) {
    const objAch = calcObjectiveAchievement(obj);
    const firstKr = obj.keyResults[0];
    objRows += `
      <tr style="background:#fffbeb;">
        <td rowspan="${Math.max(obj.keyResults.length, 1)}" style="font-weight:600;color:#1e293b;vertical-align:top;padding:8px;">${obj.title}</td>
        <td rowspan="${Math.max(obj.keyResults.length, 1)}" style="text-align:center;vertical-align:top;padding:8px;">${obj.weight}%</td>
        <td rowspan="${Math.max(obj.keyResults.length, 1)}" style="text-align:center;vertical-align:top;padding:8px;">${ach(objAch)}</td>
        ${firstKr ? `
        <td style="padding:8px;">${firstKr.title}</td>
        <td style="text-align:right;padding:8px;">${firstKr.target}</td>
        <td style="text-align:center;padding:8px;">${firstKr.unit}</td>
        <td style="text-align:center;padding:8px;">${firstKr.weight}%</td>
        <td style="text-align:right;padding:8px;">${(firstKr.teamProgress + (firstKr.leadProgress ?? 0)).toFixed(firstKr.unit === "%" ? 1 : 0)}</td>
        <td style="text-align:center;padding:8px;">${ach(firstKr.target > 0 ? Math.min(((firstKr.teamProgress + (firstKr.leadProgress ?? 0)) / firstKr.target) * 100, 100) : 0)}</td>
        ` : "<td colspan='6'></td>"}
      </tr>`;
    for (let i = 1; i < obj.keyResults.length; i++) {
      const kr = obj.keyResults[i];
      const krAch = kr.target > 0 ? Math.min(((kr.teamProgress + (kr.leadProgress ?? 0)) / kr.target) * 100, 100) : 0;
      objRows += `<tr>
        <td style="padding:8px;">${kr.title}</td>
        <td style="text-align:right;padding:8px;">${kr.target}</td>
        <td style="text-align:center;padding:8px;">${kr.unit}</td>
        <td style="text-align:center;padding:8px;">${kr.weight}%</td>
        <td style="text-align:right;padding:8px;">${(kr.teamProgress + (kr.leadProgress ?? 0)).toFixed(kr.unit === "%" ? 1 : 0)}</td>
        <td style="text-align:center;padding:8px;">${ach(krAch)}</td>
      </tr>`;
    }
  }

  const memberRows = memberAchievements
    .map((m, i) => `<tr><td style="padding:6px 8px;">${i + 1}</td><td style="padding:6px 8px;">${m.name}</td><td style="padding:6px 8px;text-align:center;">${ach(m.achievement)}</td></tr>`)
    .join("");

  const objectiveChartRows = objectives.map((obj, i) => {
    const v = calcObjectiveAchievement(obj);
    return `<div class="chart-row">
      <span class="chart-label">OBJ ${i + 1}: ${obj.title.length > 32 ? obj.title.slice(0, 32) + "…" : obj.title}</span>
      <div class="chart-track"><div class="chart-fill" style="width:${Math.min(v, 100).toFixed(1)}%;background:${barFill(v)}"></div></div>
      <span class="chart-pct" style="color:${barFill(v)}">${v.toFixed(1)}%</span>
    </div>`;
  }).join("");

  const memberChartRows = memberAchievements.map((m) => {
    const v = m.achievement;
    return `<div class="chart-row">
      <span class="chart-label-sm">${m.name.length > 20 ? m.name.slice(0, 20) + "…" : m.name}</span>
      <div class="chart-track"><div class="chart-fill" style="width:${Math.min(v, 100).toFixed(1)}%;background:${barFill(v)}"></div></div>
      <span class="chart-pct" style="color:${barFill(v)}">${v.toFixed(1)}%</span>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${divisionName} — ${quarter?.name ?? quarterId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    h2 { font-size: 14px; margin: 20px 0 8px; color: #475569; }
    .meta { color: #64748b; font-size: 11px; margin-bottom: 6px; }
    .summary { display: flex; gap: 16px; margin: 12px 0 20px; flex-wrap: wrap; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; }
    .card-label { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .card-val { font-size: 20px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #fbbf24; color: #1e293b; padding: 8px; text-align: left; font-size: 11px; font-weight: 700; }
    tr:nth-child(even) { background: #f8fafc; }
    td { border-bottom: 1px solid #f1f5f9; font-size: 11px; }
    .print-btn { margin-bottom: 16px; padding: 8px 18px; background: #fbbf24; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; }
    @media print { .print-btn { display: none; } }
    .chart-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
    .chart-label { font-size: 10px; color: #475569; width: 200px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chart-label-sm { font-size: 10px; color: #475569; width: 130px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chart-track { flex: 1; height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
    .chart-fill { height: 100%; border-radius: 6px; }
    .chart-pct { font-size: 10px; font-weight: 700; width: 44px; text-align: right; flex-shrink: 0; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  <h1>📊 ${divisionName}</h1>
  <p class="meta">Quarter: ${quarter?.name ?? quarterId} &nbsp;·&nbsp; Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>

  <div class="summary">
    <div class="card">
      <div class="card-label">Pencapaian Divisi</div>
      <div class="card-val">${divisionAchievement.toFixed(1)}%</div>
    </div>
    <div class="card">
      <div class="card-label">Objectives</div>
      <div class="card-val">${objectives.length}</div>
    </div>
    <div class="card">
      <div class="card-label">Anggota</div>
      <div class="card-val">${members.length}</div>
    </div>
  </div>

  ${objectives.length > 0 ? `
  <h2>📊 Visualisasi Capaian Objective</h2>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
    ${objectiveChartRows}
  </div>` : ""}

  <h2>🔑 OKR Detail</h2>
  <table>
    <thead>
      <tr>
        <th style="width:26%">Objective</th>
        <th style="width:7%;text-align:center">Bobot</th>
        <th style="width:9%;text-align:center">Capaian Obj</th>
        <th style="width:28%">Key Result</th>
        <th style="width:6%;text-align:right">Target</th>
        <th style="width:6%;text-align:center">Satuan</th>
        <th style="width:6%;text-align:center">Bobot KR</th>
        <th style="width:7%;text-align:right">Progress</th>
        <th style="width:9%;text-align:center">Capaian KR</th>
      </tr>
    </thead>
    <tbody>${objRows}</tbody>
  </table>

  ${memberAchievements.length > 0 ? `
  <h2>🏅 Ranking Anggota</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
      ${memberChartRows}
    </div>
    <table>
      <thead><tr><th style="width:40px">No</th><th>Nama</th><th style="width:110px;text-align:center">Pencapaian</th></tr></thead>
      <tbody>${memberRows}</tbody>
    </table>
  </div>` : ""}

  <script>
    // Auto-print only when opened directly (not iframed)
    if (window.self === window.top) window.print();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
