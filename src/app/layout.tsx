import './globals.css'
import { Inter } from 'next/font/google'
import { getServerSession } from "next-auth/next"
import { SessionProvider } from "@/components/session-provider"
import { ActiveRoleProvider } from "@/hooks/use-active-role"
import { SidebarProvider } from "@/hooks/use-sidebar"
import { BottomNavbar } from '@/components/bottom-navbar'
import { MainContentArea } from '@/components/main-content-area'
import { Toaster } from "@/components/ui/toaster"
import { Header } from '@/components/header'
import { ThemeProvider, themeInitScript } from "@/hooks/use-theme"
import { DataProvider } from "@/components/data-provider"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'MyMC App',
  description: 'Manage your MC efficiently',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // authOptions matters: without it next-auth skips this app's session callback, so the
  // session handed to the client has no id/role. The role provider then can't start, and
  // pages sit on their skeleton until some later event refreshes the session — which on
  // a phone (one page, no tab switching) can be never.
  const session = await getServerSession(authOptions)

  // Acting roles, loaded here (next to the database) so the client doesn't need a
  // separate round trip before pages can start loading their own data
  let initialActing: { actingAs: string[]; actingAt: Record<string, string> } | undefined
  if (session?.user?.id) {
    try {
      const r = await prisma.userRole.findUnique({
        where:  { userId: session.user.id },
        select: { actingAs: true, actingAt: true },
      })
      initialActing = {
        actingAs: r?.actingAs ?? [],
        actingAt: (r?.actingAt as Record<string, string> | null) ?? {},
      }
    } catch {
      // The client falls back to fetching it
    }
  }

  return (
    // suppressHydrationWarning: the theme script may add the `dark` class before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <SessionProvider session={session}>
          <ThemeProvider>
          <DataProvider>
          <ActiveRoleProvider initialActing={initialActing}>
            {session ? (
              <SidebarProvider>
                {/* Fixed top bar (56px) */}
                <Header mcHeadName={session.user.name || 'not logged in'} />

                {/* Desktop sidebar (collapsible, 76–240px) + main content */}
                <BottomNavbar />

                {/* Main — offset for fixed top bar (56px) + mobile bottom nav (60px) */}
                <main
                  className="min-h-screen"
                  style={{ paddingTop: 56, paddingBottom: 64 }}
                >
                  <MainContentArea>{children}</MainContentArea>
                </main>
              </SidebarProvider>
            ) : (
              children
            )}
            <Toaster />
          </ActiveRoleProvider>
          </DataProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
