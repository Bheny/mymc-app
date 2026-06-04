import './globals.css'
import { Inter } from 'next/font/google'
import { getServerSession } from "next-auth/next"
import { SessionProvider } from "@/components/session-provider"
import { ActiveRoleProvider } from "@/hooks/use-active-role"
import { BottomNavbar } from '@/components/bottom-navbar'
import { ContextBanner } from '@/components/context-banner'
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
              <>
                {/* Fixed top bar (56px) */}
                <Header mcHeadName={session.user.name || 'not logged in'} />

                {/* Desktop sidebar (240px) + main content */}
                <BottomNavbar />

                {/* Main — offset for fixed top bar (56px) + mobile bottom nav (60px) */}
                <main
                  className="min-h-screen"
                  style={{ paddingTop: 56, paddingBottom: 64 }}
                >
                  <div className="lg:pl-[240px]" style={{ minHeight: 'calc(100vh - 56px)' }}>
                    {/* Context banner sits in the normal flow (sticky), so content
                        below it is never overlapped */}
                    <ContextBanner />
                    {children}
                  </div>
                </main>
              </>
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
