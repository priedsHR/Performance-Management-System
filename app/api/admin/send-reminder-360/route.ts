import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const APP_URL = process.env.NEXTAUTH_URL ?? "";
const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? "";

function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

function buildEmail360Html({
  name,
  type,
  periodName,
  pendingCount,
}: {
  name: string;
  type: "initial" | "followup";
  periodName: string;
  pendingCount: number;
}) {
  const isFollowUp = type === "followup";
  const subject = isFollowUp
    ? `[Follow Up] Mohon segera lengkapi penilaian 360° – ${periodName}`
    : `[Reminder] Mohon isi penilaian 360° – ${periodName}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#0d9488;padding:20px 32px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">360° Feedback</p>
            <p style="margin:4px 0 0;color:#99f6e4;font-size:13px;">${periodName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#0f172a;">
              ${isFollowUp ? "⚠️ Follow Up Penilaian 360°" : "📝 Reminder Pengisian 360°"}
            </p>
            <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
              Halo <strong>${name}</strong>,<br><br>
              ${isFollowUp
                ? `Ini adalah <strong>follow up</strong> untuk mengingatkan bahwa kamu masih memiliki <strong>${pendingCount} penilaian</strong> yang belum selesai untuk periode <strong>${periodName}</strong>. Mohon segera diselesaikan sebelum periode berakhir.`
                : `Kamu memiliki <strong>${pendingCount} penilaian 360°</strong> yang perlu diisi pada periode <strong>${periodName}</strong>. Mohon luangkan waktu untuk mengisinya sebelum batas waktu.`
              }
            </p>
            <div style="background:#f0fdf9;border:1px solid #99f6e4;border-radius:10px;padding:14px 18px;margin:16px 0;">
              <p style="margin:0;font-size:13px;color:#0f766e;">📊 <strong>${pendingCount} penilaian</strong> belum selesai</p>
            </div>
            <a href="${APP_URL}/360"
               style="display:inline-block;background:#0d9488;color:#ffffff;font-weight:bold;font-size:14px;
                      padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:8px;">
              Isi Penilaian 360° →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Email ini dikirim otomatis oleh sistem Performance Management. Jangan balas email ini.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, periodId }: { type: "initial" | "followup"; periodId: string } = await req.json();

  if (!type || !periodId)
    return NextResponse.json({ error: "type dan periodId wajib diisi." }, { status: 400 });

  const period = await prisma.feedbackPeriod.findUnique({ where: { id: periodId } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan." }, { status: 404 });

  // Get all users with a feedbackProfile and pending (unsubmitted) responses
  const usersWithPending = await prisma.user.findMany({
    where: {
      feedbackProfile: { active: true },
      feedbackGiven: {
        some: { periodId, submitted: false },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      feedbackGiven: {
        where: { periodId, submitted: false },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  if (usersWithPending.length === 0) {
    return NextResponse.json({ success: true, message: "Semua penilaian sudah selesai. Tidak ada email yang dikirim.", results: [] });
  }

  const transporter = createTransporter();
  const results: { name: string; email: string; status: "sent" | "skipped" | "error"; reason?: string; error?: string }[] = [];

  for (const user of usersWithPending) {
    if (!user.email) {
      results.push({ name: user.name ?? "-", email: "-", status: "error", error: "Tidak ada email" });
      continue;
    }

    const pendingCount = user.feedbackGiven.length;
    const { subject, html } = buildEmail360Html({ name: user.name ?? user.email, type, periodName: period.name, pendingCount });

    try {
      await transporter.sendMail({ from: `Performance Management <${GMAIL_USER}>`, to: user.email, subject, html });
      results.push({ name: user.name ?? "-", email: user.email, status: "sent" });
    } catch (err) {
      results.push({ name: user.name ?? "-", email: user.email, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  const errCount = results.filter((r) => r.status === "error").length;
  const parts = [];
  if (sentCount > 0) parts.push(`${sentCount} email terkirim`);
  if (errCount > 0) parts.push(`${errCount} gagal`);

  return NextResponse.json({ success: sentCount > 0, message: parts.join(", ") + ".", results });
}
