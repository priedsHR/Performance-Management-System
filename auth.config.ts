import type { NextAuthConfig } from "next-auth";

// Edge-compatible — no Node.js-only imports
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const },
  providers: [],
} satisfies NextAuthConfig;
