"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { ContextBanner } from "@/components/context-banner";

export function MainContentArea({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={`transition-[padding-left] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]"}`}
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      {/* Context banner sits in the normal flow (sticky), so content
          below it is never overlapped */}
      <ContextBanner />
      {children}
    </div>
  );
}
