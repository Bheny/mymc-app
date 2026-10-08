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
  const session = await getServerSession()

  return (
    // suppressHydrationWarning: the theme script may add the `dark` class before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <SessionProvider session={session}>
          <ThemeProvider>
          <ActiveRoleProvider>
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
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
