"use client";
import Link from 'next/link'
import { UserCircle, Settings, User, LogOut, Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { signOut } from 'next-auth/react'

export function Header({ mcHeadName }: { mcHeadName: string }) {
  const handleLogout = async () => {
    // Use next-auth's signOut to invalidate the session
    await signOut({ redirect: true, callbackUrl: '/login' });
  };

  return (
    <header className="fixed left-0 right-0 top-0 bg-white z-30 shadow">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
      <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight  bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">MyMC App<sub className="text-sm">beta</sub></h1>

        <div className="flex items-center">
        <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
      <Bell className="h-8 w-8 text-gray-400" />
      {/* Badge for unread notifications */}
      <div className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500" />
    </Button>
  </DropdownMenuTrigger>
  
  <DropdownMenuContent className="w-80" align="end" forceMount>
    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
    <DropdownMenuSeparator />

    {/* Loading state (if needed) */}
    <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>

    {/* No notifications state */}
    {/* <div className="px-4 py-2 text-sm text-gray-500">No new notifications</div> */}

    {/* Notifications List */}
    <DropdownMenuItem>
      <div className="flex flex-col space-y-2">
        {/* Example notification item */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">New comment on your post</span>
          <span className="text-xs text-gray-400">2m ago</span>
        </div>
        <p className="text-gray-500">John Doe commented on your recent post about React components.</p>
      </div>
    </DropdownMenuItem>

    <DropdownMenuItem>
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">New follower</span>
          <span className="text-xs text-gray-400">10m ago</span>
        </div>
        <p className="text-gray-500">Jane Smith started following you.</p>
      </div>
    </DropdownMenuItem>

    {/* Unread Notifications */}
    <DropdownMenuItem className="bg-gray-100">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-blue-500">New like on your photo</span>
          <span className="text-xs text-gray-400">1 hour ago</span>
        </div>
        <p className="text-gray-500">You received a like on your profile picture from Alice Cooper.</p>
      </div>
    </DropdownMenuItem>

    {/* Separator and Clear All button */}
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-center text-sm text-blue-600 hover:bg-blue-50">
      Clear All
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-12 w-12 rounded-full">
                <UserCircle className="h-12 w-12 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{mcHeadName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {mcHeadName.toLowerCase().replace(' ', '.')}@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* <span className="ml-2 text-sm font-medium text-gray-700">{mcHeadName}</span> */}
        </div>
      </div>
    </header>
  )
}

