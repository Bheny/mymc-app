"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// A thin bar across the top while a page change is in flight, so tapping a link always
// gives instant feedback even if the next screen takes a moment.
//
// It starts when an in-app link to a different page is clicked, creeps toward 85%, and
// completes when the path actually changes. It gives up after 10s so it can never stick.

export function RouteProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const creep = useRef<ReturnType<typeof setInterval> | null>(null);
  const running = useRef(false);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (creep.current) { clearInterval(creep.current); creep.current = null; }
  };

  const start = () => {
    if (running.current) return;
    running.current = true;
    clearAll();
    setVisible(true);
    setWidth(8);
    creep.current = setInterval(() => setWidth((w) => (w < 85 ? w + (85 - w) * 0.12 : w)), 200);
    timers.current.push(setTimeout(finish, 10_000));
  };

  const finish = () => {
    if (!running.current) return;
    running.current = false;
    clearAll();
    setWidth(100);
    timers.current.push(setTimeout(() => setVisible(false), 250));
    timers.current.push(setTimeout(() => setWidth(0), 500));
  };

  // New path arrived → done
  useEffect(() => { finish(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clicking an in-app link to another page → start
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;   // same page (or just a query change)
      start();
    };
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); clearAll(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div aria-hidden className="fixed left-0 right-0 top-0 z-[100] h-[2px] pointer-events-none"
         style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}>
      <div className="h-full"
           style={{
             width: `${width}%`, background: "var(--brand-link)",
             transition: width === 100 ? "width 150ms ease-out" : "width 200ms linear",
             boxShadow: "0 0 8px var(--brand-link)",
           }} />
    </div>
  );
}
