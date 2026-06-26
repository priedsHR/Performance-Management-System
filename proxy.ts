import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isSetupPage = pathname === "/setup";

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // On HTTPS (Vercel production) cookie has __Secure- prefix
    secureCookie: process.env.NODE_ENV === "production",
  });

  // Logged in → don't show login page again
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in → send to login (unless already there or on setup page)
  if (!token && !isLoginPage && !isSetupPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
