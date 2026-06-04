import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Already on the change-password page — let through
    if (pathname === "/change-password") return NextResponse.next();

    // Force first-login password change before anything else
    if (token?.mustChangePassword) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Only authorised (logged-in) users reach the middleware function above
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

// Apply to every route except static assets, images, and auth API
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)",
  ],
};
