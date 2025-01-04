import './globals.css'
import { Inter } from 'next/font/google'
import { BottomNavbar } from '@/components/bottom-navbar'
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'MyMC App',
  description: 'Manage your MC efficiently',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F9FCFF]`}>
        <div className="min-h-screen pt-12 pb-16">
          {children}
          <BottomNavbar />
        </div>
        <Toaster />
      </body>
    </html>
  )
}

