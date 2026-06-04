'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Calendar, TrendingUp, Settings } from 'lucide-react';

const navItems = [
  { name: 'Overview', href: '/', icon: Home },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Reports', href: '/reports', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function ResponsiveNavbar() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-64 bg-white shadow-lg border-r border-gray-200 flex-col p-4">
        <h2 className="text-xl font-bold mb-6 text-center">Dashboard</h2>
        <ul className="space-y-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Bottom Navbar for Mobile */}
      <nav className="lg:hidden fixed z-30 bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-md">
        <div className="max-w-screen-xl mx-auto px-4">
          <ul className="flex justify-around">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name} className="flex-1">
                  <Link
                    href={item.href}
                    className={`flex flex-col items-center py-2 text-xs ${
                      isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
                    }`}
                  >
                    <item.icon className="h-6 w-6 mb-1" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
