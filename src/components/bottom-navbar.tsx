'use client';

import Link from 'next/link';
import { usePathname} from 'next/navigation';
import { Home, Users, Calendar, TrendingUp, Settings } from 'lucide-react';
// import { useSession, signOut } from 'next-auth/react';

const navItems = [
  { name: 'Overview', href: '/', icon: Home },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Reports', href: '/reports', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function BottomNavbar() {
  // const { data: session } = useSession(); // Check session status
  const pathname = usePathname();
  // const router = useRouter();

  // const handleLogout = async () => {
  //   // Use next-auth's signOut to invalidate the session
  //   await signOut({ redirect: true, callbackUrl: '/login' });
  // };

  return (
    <nav className="fixed z-30 bottom-0 left-0 right-0 bg-white border-t border-gray-200">
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
          {/* {session && ( // Show logout button only if authenticated
            <li className="flex-1">
              <button
                onClick={handleLogout}
                className="flex flex-col items-center py-2 text-xs text-[#7096D1] hover:text-[#D0E3FF] w-full"
              >
                <LogOut className="h-6 w-6 mb-1" />
                <span>Logout</span>
              </button>
            </li>
          )} */}
        </ul>
      </div>
    </nav>
  );
}