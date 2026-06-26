import nodemailer from "nodemailer";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://okr-jakmall.vercel.app";
const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? "";

function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });
}

export type ReminderType = "settings" | "results" | "collection";

export type KRIssue = { title: string; issues: string[] };
export type ObjectiveIssue = { title: string; issues: string[]; krIssues: KRIssue[] };
export type CompletionIssues = {
  hasNoObjectives: boolean;
  summaryIssues: string[];
  objectives: ObjectiveIssue[];
};

function buildIssuesHtml(issues: CompletionIssues): string {
  if (issues.hasNoObjectives) {
    return `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;font-weight:bold;color:#dc2626;">⚠️ Belum ada Objective yang dibuat</p>
        <p style="margin:6px 0 0;font-size:13px;color:#ef4444;">Silakan buat minimal satu Objective beserta Key Results-nya.</p>
      </div>`;
  }

  const summaryHtml = issues.summaryIssues.length > 0
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;margin:16px 0 8px;">
        ${issues.summaryIssues.map(iss =>
          `<p style="margin:2px 0;font-size:13px;color:#dc2626;">⚠️ ${iss}</p>`
        ).join("")}
      </div>`
    : "";

  if (issues.summaryIssues.length === 0 && issues.objectives.length === 0) return "";

  const rows = issues.objectives.map((obj) => {
    const objIssueRows = obj.issues.map(
      (iss) => `<li style="color:#b45309;font-size:13px;margin:3px 0;">${iss}</li>`
    ).join("");

    const krRows = obj.krIssues.map((kr) => {
      const krIssueItems = kr.issues.map(
        (iss) => `<span style="display:inline-block;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 7px;font-size:12px;margin:2px 3px 2px 0;">${iss}</span>`
      ).join("");
      return `
        <tr>
          <td style="padding:5px 0 5px 16px;vertical-align:top;">
            <span style="font-size:13px;color:#374151;">📌 ${kr.title}</span><br>
            <span style="display:inline-block;margin-top:3px;">${krIssueItems}</span>
          </td>
        </tr>`;
    }).join("");

    return `
      <tr>
        <td style="padding:8px 0;">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#1c1917;">🎯 ${obj.title}</p>
            ${obj.issues.length > 0 ? `<ul style="margin:4px 0 6px 16px;padding:0;">${objIssueRows}</ul>` : ""}
            ${obj.krIssues.length > 0 ? `<table width="100%" cellpadding="0" cellspacing="0">${krRows}</table>` : ""}
          </div>
        </td>
      </tr>`;
  }).join("");

  return `
    <div style="margin:20px 0;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:bold;color:#dc2626;">⚠️ Bagian yang perlu dilengkapi:</p>
      ${summaryHtml}
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </div>`;
}

export async function sendReminderEmail({
  to,
  name,
  type,
  quarterName,
  quarterId,
  completionIssues,
}: {
  to: string;
  name: string;
  type: ReminderType;
  quarterName: string;
  quarterId: string;
  completionIssues: CompletionIssues;
}) {
  const isSettings = type === "settings";
  const isCollection = type === "collection";

  const subject = isSettings
    ? `[Reminder] Mohon lengkapi OKR Divisi – ${quarterName}`
    : isCollection
    ? `[Reminder Pengumpulan] Mohon lengkapi data OKR – ${quarterName}`
    : `[Reminder] Mohon update progress OKR – ${quarterName}`;

  const actionLabel = isSettings ? "Buka Halaman OKR" : "Buka Halaman Distribusi";
  const link = isSettings
    ? `${APP_URL}/okr?quarterId=${quarterId}`
    : `${APP_URL}/distribusi?quarterId=${quarterId}`;

  const introParagraph = isSettings
    ? `Halo <strong>${name}</strong>,<br><br>
       Berikut adalah ringkasan <strong>OKR Divisi</strong> kamu untuk quarter <strong>${quarterName}</strong>
       yang masih perlu dilengkapi sebelum batas waktu pengumpulan.`
    : isCollection
    ? `Halo <strong>${name}</strong>,<br><br>
       Ini adalah <strong>reminder pengumpulan akhir quarter</strong> untuk <strong>${quarterName}</strong>.
       Pastikan seluruh data OKR sudah lengkap — bobot, target, satuan, progress anggota, dan capaian.`
    : `Halo <strong>${name}</strong>,<br><br>
       Berikut adalah ringkasan <strong>progress/hasil OKR</strong> divisi kamu
       untuk quarter <strong>${quarterName}</strong> yang masih perlu diupdate.`;

  const issuesHtml = buildIssuesHtml(completionIssues);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#fbbf24;padding:20px 32px;">
            <p style="margin:0;color:#1c1917;font-size:18px;font-weight:bold;">📈 OKR Tracker</p>
            <p style="margin:4px 0 0;color:#78350f;font-size:13px;">${quarterName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#0f172a;">
              ${isSettings ? "⏰ Reminder Pengisian OKR" : isCollection ? "📋 Reminder Pengumpulan OKR" : "📊 Reminder Update Progress OKR"}
            </p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;">
              ${introParagraph}
            </p>
            ${issuesHtml}
            <a href="${link}"
               style="display:inline-block;background:#fbbf24;color:#1c1917;font-weight:bold;font-size:14px;
                      padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:8px;">
              ${actionLabel} →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Email ini dikirim otomatis oleh sistem OKR Tracker. Jangan balas email ini.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `OKR Tracker <${GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
