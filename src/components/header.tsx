"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, UserCircle, Settings, User, LogOut, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

type Notification = {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  read:      boolean;
  linkHref:  string | null;
  createdAt: string;
};

export function Header({ mcHeadName }: { mcHeadName: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen,     setNotifOpen]     = useState(false);

  useEffect(() => {
    fetch("/api/me/notifications")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setNotifications(d); })
      .catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    await fetch("/api/me/notifications/read-all", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 bg-white"
      style={{ borderBottom: "1px solid var(--brand-border)" }}
    >
      <div
        className="flex items-center justify-between px-4 sm:px-6"
        style={{ height: 56 }}
      >
        {/* Left: app name (visible on mobile where sidebar is hidden) */}
        <span
          className="lg:hidden text-[15px] font-semibold"
          style={{ color: "var(--brand-navy)" }}
        >
          MyMC
          <span
            className="ml-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
            style={{
              background: "var(--brand-navy-light)",
              color: "var(--brand-navy)",
            }}
          >
            beta
          </span>
        </span>

        {/* Spacer — on desktop the sidebar occupies the left 240px */}
        <div className="hidden lg:block" />

        {/* Right: notification + user menu */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-lg"
                aria-label="Notifications"
              >
                <Bell className="h-[18px] w-[18px]" style={{ color: "var(--brand-muted)" }} />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1 right-1 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: "var(--brand-danger)" }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-96" align="end" style={{ maxHeight: 480, overflowY: "auto" }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5"
                   style={{ borderBottom: "1px solid var(--brand-border)" }}>
                <span className="text-[12px] font-semibold uppercase tracking-[0.04em]"
                      style={{ color: "var(--brand-muted)" }}>
                  Notifications {unreadCount > 0 && `(${unreadCount} new)`}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] font-medium hover:opacity-70 transition-opacity"
                    style={{ color: "var(--brand-navy)" }}
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px]" style={{ color: "var(--brand-muted)" }}>
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const content = (
                    <div
                      className="px-4 py-3 flex items-start gap-3 transition-colors hover:bg-[var(--brand-navy-light)]"
                      style={{
                        borderBottom: "1px solid var(--brand-border)",
                        background: n.read ? "transparent" : "#F0F4FA",
                      }}
                    >
                      {/* Unread dot */}
                      <span
                        className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                        style={{ background: n.read ? "transparent" : "var(--brand-danger)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--brand-text)" }}>
                          {n.title}
                        </p>
                        <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--brand-muted)" }}>
                          {n.body}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--brand-muted)" }}>
                          {new Date(n.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                  return n.linkHref ? (
                    <Link key={n.id} href={n.linkHref} onClick={() => setNotifOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg"
                aria-label="User menu"
              >
                <UserCircle className="h-[22px] w-[22px]" style={{ color: "var(--brand-muted)" }} />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                  {mcHeadName}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
                  {mcHeadName.toLowerCase().replace(" ", ".")}@example.com
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 text-[14px]">
                  <User className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 text-[14px]">
                  <Settings className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 text-[14px]"
                style={{ color: "var(--brand-danger)" }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
