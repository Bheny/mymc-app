import './globals.css'
import { Inter } from 'next/font/google'
import { BottomNavbar } from '../components/bottom-navbar'

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
      <body className={inter.className}>
        <div className="min-h-screen bg-[#f5f5f5] pb-16">
          {children}
          <BottomNavbar />
        </div>
      </body>
    </html>
  )
}

