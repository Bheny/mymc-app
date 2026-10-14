import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// This is the middleware Next.js runs (the app lives in src/, so a root-level
// middleware.ts would be ignored).
export default withAuth(
  function middleware(req) {
    // First login: a temporary password must be replaced before anything else
    if (req.nextauth.token?.mustChangePassword && req.nextUrl.pathname !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", req.url))
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      // Only signed-in users reach the function above; others go to /login
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  },
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - l/ (public library share links)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|login|l/).*)",
  ],
}
