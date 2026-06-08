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
    <html lang="en">
      <body className={inter.className} style={{ backgroundColor: '#FFFFFF' }}>
        <SessionProvider session={session}>
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
        </SessionProvider>
      </body>
    </html>
  )
}
