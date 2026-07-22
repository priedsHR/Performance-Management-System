import nodemailer from "nodemailer";

// Fallback keeps email links working even if NEXTAUTH_URL isn't set.
const APP_URL = process.env.NEXTAUTH_URL || "https://performance-management-system-phi.vercel.app";
const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? "";

export function has360Email() {
  return !!(GMAIL_USER && GMAIL_PASS);
}

export function create360Transporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

export const FROM_360 = `PRIEDS Performance <${GMAIL_USER}>`;

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// One template for all 360 emails: cycle start, manual reminder, and the
// automatic D-3 reminder. Always shows the deadline, the auto-reminder note,
// and a button that takes the employee straight to the login/assessment page.
export function build360Email({
  name,
  kind,
  periodName,
  deadline,
  pendingCount,
}: {
  name: string;
  kind: "start" | "reminder" | "followup";
  periodName: string;
  deadline: Date | null;
  pendingCount: number;
}) {
  const deadlineStr = fmtDate(deadline);
  const heading =
    kind === "start" ? "Your 360° Feedback cycle is now open"
    : kind === "followup" ? "Reminder: your 360° Feedback is due soon"
    : "Please complete your 360° Feedback";
  const subject =
    kind === "start" ? `360° Feedback is now open – ${periodName}`
    : kind === "followup" ? `[Reminder] 360° Feedback due ${deadlineStr} – ${periodName}`
    : `[Action needed] Complete your 360° Feedback – ${periodName}`;

  const intro =
    kind === "start"
      ? `The <strong>${periodName}</strong> 360° Feedback cycle has started. Please rate the colleagues assigned to you and share honest, constructive feedback.`
      : `You still have <strong>${pendingCount} assessment${pendingCount === 1 ? "" : "s"}</strong> to complete for the <strong>${periodName}</strong> cycle.`;

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f8fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f8fb;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#097eb9;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">PRIEDS · 360° Feedback</p>
          <p style="margin:4px 0 0;color:#b7e7f7;font-size:13px;">${periodName}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 14px;font-size:21px;font-weight:bold;color:#0f172a;">${heading}</p>
          <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
            Hello <strong>${name}</strong>,<br><br>${intro}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
            <tr>
              <td style="background:#eef9fd;border:1px solid #b7e7f7;border-radius:10px;padding:12px 16px;">
                <p style="margin:0;font-size:13px;color:#097eb9;">📅 Deadline: <strong>${deadlineStr || "see portal"}</strong></p>
              </td>
            </tr>
          </table>
          <a href="${APP_URL}/login"
             style="display:inline-block;background:#0b8ec4;color:#ffffff;font-weight:bold;font-size:14px;padding:13px 26px;border-radius:10px;text-decoration:none;">
            Open the portal &amp; submit →
          </a>
          <p style="margin:16px 0 0;color:#94a3b8;font-size:12.5px;line-height:1.6;">
            Sign in with your PRIEDS work email. If you don't submit in time, you'll receive an
            automatic reminder <strong>3 days before the deadline</strong>. Your feedback is anonymous.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent automatically by the PRIEDS Performance Management system. Please do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}
