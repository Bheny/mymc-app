import './globals.css'
import { Inter } from 'next/font/google'
import { getServerSession } from "next-auth/next"
import { SessionProvider } from "@/components/session-provider"
import { BottomNavbar } from '@/components/bottom-navbar'
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
      <body className={`${inter.className} bg-[#F9FCFF]`}>
        <SessionProvider session={session}>
          {session ? (
            <div className="min-h-screen pt-16 pb-16">
              <Header mcHeadName={session.user.name || 'not logged in'} />

              {children}
              <BottomNavbar />
            </div>
          ) : (
            children
          )}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}

