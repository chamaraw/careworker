"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, BookOpen, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const bottomItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/roster", label: "Roster", icon: Calendar },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/hours", label: "Hours", icon: Clock },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[var(--nav-bottom-border)] bg-[var(--nav-bottom-bg)] backdrop-blur-md shadow-[0 -4px 14px rgba(0,0,0,0.08)] safe-area-pb">
      <div className="grid grid-cols-5 h-16 min-h-[4rem]">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation",
                "transition-all duration-150 ease-out active:scale-95",
                active
                  ? "text-[var(--sidebar-primary)] font-semibold"
                  : "text-[var(--sidebar-foreground)]/70"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--sidebar-primary)]" aria-hidden />
              )}
              <Icon className="size-6 shrink-0" aria-hidden strokeWidth={active ? 2.5 : 2} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
