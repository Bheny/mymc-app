'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Calendar, TrendingUp, Settings } from 'lucide-react'

const navItems = [
  { name: 'Overview', href: '/', icon: Home },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Reports', href: '/reports', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function BottomNavbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="max-w-screen-xl mx-auto px-4">
        <ul className="flex justify-around">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name} className="flex-1">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center py-2 text-xs ${
                    isActive
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-blue-600'
                  }`}
                >
                  <item.icon className="h-6 w-6 mb-1" />
                  <span>{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

