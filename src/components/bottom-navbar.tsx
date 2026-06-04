'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Home, Users, Network, TrendingUp, Settings,
  LayoutGrid, ClipboardList, Building2, Heart,
  BarChart2, Menu, X,
} from 'lucide-react';
import { useActiveRole, roleLabel as getRoleLabel, type RoleView } from '@/hooks/use-active-role';
import { RoleSwitcher } from '@/components/role-switcher';
import { Check } from 'lucide-react';

type NavItem = { name: string; short?: string; href: string; icon: React.ElementType };
type NavConfig = { primary: NavItem[]; secondary: NavItem[] };

// ─── Nav definitions ──────────────────────────────────────────────────────────

const ADMIN_NAV: NavConfig = {
  primary: [
    { name: 'Overview', href: '/',         icon: Home },
    { name: 'Members',  href: '/members',  icon: Users },
    { name: 'Org',      href: '/org',      icon: Network },
    { name: 'Analysis', href: '/analysis', icon: BarChart2 },
  ],
  secondary: [
    { name: 'Reports',  href: '/reports',  icon: TrendingUp },
    { name: 'Settings', href: '/settings', icon: Settings },
  ],
};

const MC_PASTOR_NAV: NavConfig = {
  primary: [
    { name: 'Overview', href: '/',        icon: Home },
    { name: 'Members',  href: '/members', icon: Users },
    { name: 'Org',      href: '/org',     icon: Network },
    { name: 'Settings', href: '/settings', icon: Settings },
  ],
  secondary: [],
};

const BUSCENTRE_HEAD_NAV: NavConfig = {
  primary: [
    { name: 'Overview',     href: '/',          icon: Home },
    { name: 'My Buscentre', short: 'Buscentre', href: '/buscentre', icon: Building2 },
    { name: 'Members',      href: '/members',   icon: Users },
    { name: 'Analysis',     href: '/analysis',  icon: BarChart2 },
  ],
  secondary: [
    { name: 'Org',      href: '/org',      icon: Network },
    { name: 'Settings', href: '/settings', icon: Settings },
  ],
};

const CELL_SHEPHERD_NAV: NavConfig = {
  primary: [
    { name: 'Overview',   href: '/',          icon: Home },
    { name: 'My Cell',    short: 'Cell',      href: '/cell',       icon: LayoutGrid },
    { name: 'Attendance', short: 'Attend',    href: '/attendance', icon: ClipboardList },
    { name: 'Souls',      href: '/souls',     icon: Heart },
  ],
  secondary: [
    { name: 'Members',  href: '/members',  icon: Users },
    { name: 'Analysis', href: '/analysis', icon: BarChart2 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ],
};

const SHEPHERD_NAV: NavConfig = {
  primary: [
    { name: 'Overview', href: '/',         icon: Home },
    { name: 'Members',  href: '/members',  icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ],
  secondary: [],
};

function navConfigForRole(role: string | null | undefined): NavConfig {
  switch (role) {
    case 'admin':
    case 'chief_shepherd': return ADMIN_NAV;
    case 'mc_pastor':      return MC_PASTOR_NAV;
    case 'buscentre_head': return BUSCENTRE_HEAD_NAV;
    case 'cell_shepherd':  return CELL_SHEPHERD_NAV;
    case 'shepherd':       return SHEPHERD_NAV;
    default:               return ADMIN_NAV;
  }
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

// ─── Hamburger drawer ─────────────────────────────────────────────────────────

function HamburgerDrawer({
  items,
  open,
  onClose,
  pathname,
  userName,
  role,
  allViews,
  activeView,
  switchToView,
}: {
  items:        NavItem[];
  open:         boolean;
  onClose:      () => void;
  pathname:     string;
  userName:     string | null | undefined;
  role:         string | null | undefined;
  allViews:     RoleView[];
  activeView:   RoleView | null;
  switchToView: (key: string) => void;
}) {
  const roleLabel = role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
  const hasMultipleViews = allViews.length > 1;

  return (
    <>
      {/* Backdrop — stops at the nav bar so it stays visible */}
      <div
        className="lg:hidden fixed left-0 right-0 top-0 z-40 transition-opacity duration-200"
        style={{
          bottom:        64,
          background:    'rgba(0,0,0,0.45)',
          opacity:       open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Drawer panel — anchored just above the 64px nav bar */}
      <div
        className="lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl flex flex-col transition-transform duration-300 ease-out"
        style={{
          bottom:    64,
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          maxHeight: 'calc(70vh - 64px)',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="rounded-full" style={{ width: 36, height: 4, background: 'var(--brand-border)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--brand-border)' }}
        >
          <div>
            <p className="text-[15px] font-semibold" style={{ color: 'var(--brand-text)' }}>
              {userName ?? 'Menu'}
            </p>
            {roleLabel && (
              <p className="text-[12px]" style={{ color: 'var(--brand-muted)' }}>{roleLabel}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, background: 'var(--brand-navy-light)' }}
          >
            <X style={{ width: 16, height: 16, color: 'var(--brand-navy)' }} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col py-2 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                style={{
                  background: active ? 'var(--brand-navy-light)' : 'transparent',
                  borderLeft: active ? `3px solid var(--brand-navy)` : '3px solid transparent',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{
                    width:      40,
                    height:     40,
                    background: active ? 'var(--brand-navy)' : 'var(--brand-navy-light)',
                    flexShrink: 0,
                  }}
                >
                  <item.icon style={{ width: 18, height: 18, color: active ? '#fff' : 'var(--brand-navy)' }} />
                </div>
                <span
                  className="text-[15px]"
                  style={{ color: 'var(--brand-text)', fontWeight: active ? 600 : 400 }}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* ── Role switcher (mobile) ── */}
        {hasMultipleViews && (
          <div style={{ borderTop: '1px solid var(--brand-border)', padding: '12px 20px 16px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2"
               style={{ color: 'var(--brand-muted)' }}>
              Switch View
            </p>
            {allViews.map((view) => {
              const isCurrent = view.key === activeView?.key;
              return (
                <button
                  key={view.key}
                  onClick={() => { switchToView(view.key); onClose(); }}
                  className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg transition-colors hover:bg-[var(--brand-navy-light)]"
                >
                  <span style={{ width: 18, flexShrink: 0 }}>
                    {isCurrent && <Check style={{ width: 14, height: 14, color: 'var(--brand-navy)' }} />}
                  </span>
                  <span className="flex-1 text-left text-[14px]"
                        style={{ color: 'var(--brand-text)', fontWeight: isCurrent ? 600 : 400 }}>
                    {getRoleLabel(view.role)}
                  </span>
                  {view.isActing && (
                    <span className="text-[10px] font-semibold rounded-pill px-2 py-0.5"
                          style={{ background: '#FEF3DC', color: '#854F0B' }}>
                      acting
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BottomNavbar() {
  const pathname              = usePathname();
  const { data: session }     = useSession();
  const { activeView, allViews, switchToView } = useActiveRole();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role       = activeView?.role ?? session?.user?.role;
  const config     = navConfigForRole(role);
  const allItems   = [...config.primary, ...config.secondary];
  const hasDrawer  = config.secondary.length > 0;
  const moreActive = hasDrawer && config.secondary.some((i) => isActive(pathname, i.href));

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex fixed top-0 left-0 h-full flex-col"
        style={{ width: 240, backgroundColor: 'var(--brand-navy)', zIndex: 30 }}
      >
        {/* Logo */}
        <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="text-white font-semibold text-[15px] tracking-tight">MyMC</span>
          <span
            className="ml-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
          >
            beta
          </span>
        </div>

        <p
          className="px-5 pt-5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Main
        </p>

        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {allItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-2.5 px-5 py-2.5 text-[14px] transition-colors duration-150"
                style={{
                  color:      active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                  fontWeight: active ? 500 : 400,
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderLeft: active ? '3px solid #ffffff' : '3px solid transparent',
                }}
              >
                <item.icon style={{ width: 18, height: 18 }} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <RoleSwitcher />
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed z-[60] bottom-0 left-0 right-0 bg-white"
        style={{ borderTop: '1px solid var(--brand-border)', height: 64 }}
      >
        <ul className="flex h-full justify-around items-center px-1">
          {config.primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.name} className="flex-1">
                <Link
                  href={item.href}
                  className="flex flex-col items-center gap-1 pt-1.5 pb-1"
                >
                  {/* Solid pill when active, transparent when not */}
                  <div
                    className="flex items-center justify-center rounded-xl transition-all duration-150"
                    style={{
                      width:      44,
                      height:     30,
                      background: active ? 'var(--brand-navy)' : 'transparent',
                    }}
                  >
                    <item.icon
                      style={{
                        width:  19,
                        height: 19,
                        color:  active ? '#ffffff' : 'var(--brand-muted)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[10.5px] font-medium leading-none whitespace-nowrap"
                    style={{ color: active ? 'var(--brand-navy)' : 'var(--brand-muted)' }}
                  >
                    {item.short ?? item.name}
                  </span>
                </Link>
              </li>
            );
          })}

          {/* Hamburger — only when there are secondary items */}
          {hasDrawer && (
            <li className="flex-1">
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-full flex flex-col items-center gap-1 pt-1.5 pb-1"
              >
                <div
                  className="flex items-center justify-center rounded-xl transition-all duration-150"
                  style={{
                    width:      44,
                    height:     30,
                    background: moreActive ? 'var(--brand-navy)' : 'transparent',
                  }}
                >
                  <Menu
                    style={{
                      width:  19,
                      height: 19,
                      color:  moreActive ? '#ffffff' : 'var(--brand-muted)',
                    }}
                  />
                </div>
                <span
                  className="text-[10.5px] font-medium leading-none whitespace-nowrap"
                  style={{ color: moreActive ? 'var(--brand-navy)' : 'var(--brand-muted)' }}
                >
                  More
                </span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* ── Hamburger drawer ─────────────────────────────────────────── */}
      <HamburgerDrawer
        items={config.secondary}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pathname={pathname}
        userName={session?.user?.name}
        role={role}
        allViews={allViews}
        activeView={activeView}
        switchToView={switchToView}
      />
    </>
  );
}
