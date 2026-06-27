import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = { label: string; href?: string };

export function BreadcrumbTrail({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 text-[13px] flex-wrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:underline" style={{ color: "var(--brand-navy)" }}>
                {item.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? "var(--brand-text)" : "var(--brand-muted)", fontWeight: isLast ? 600 : 400 }}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
