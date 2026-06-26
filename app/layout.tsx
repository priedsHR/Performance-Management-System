import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Performance Management System",
  description: "OKR & 360° Feedback",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
