import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname.startsWith("/login");
  const isPublicAsset = nextUrl.pathname.startsWith("/_next") || nextUrl.pathname.startsWith("/api/auth");

  if (isPublicAsset) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

  const role = req.auth?.user?.role;
  if (nextUrl.pathname.startsWith("/modulos/administracao") && role !== "ADMINISTRADOR") {
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }
  if (nextUrl.pathname.startsWith("/modulos/colaboradores") && role !== "ADMINISTRADOR" && role !== "RH") {
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
