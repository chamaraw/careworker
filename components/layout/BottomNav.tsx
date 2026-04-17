"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { LayoutDashboard, Calendar, BookOpen, Clock, AlertTriangle, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

const workerItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/roster", label: "Roster", icon: Calendar },
  { href: "/dashboard#worker-hours", label: "Hours", icon: Clock },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/notes", label: "Notes", icon: BookOpen },
];

const adminItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/roster", label: "Roster", icon: Calendar },
  { href: "/payroll", label: "Payroll", icon: Banknote },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/notes", label: "Notes", icon: BookOpen },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const bottomItems = isAdmin ? adminItems : workerItems;
  const [hash, setHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : ""
  );

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[var(--nav-bottom-border)] bg-[var(--nav-bottom-bg)] backdrop-blur-md shadow-[0 -4px 14px rgba(0,0,0,0.08)] safe-area-pb">
      <div className="grid grid-cols-5 h-16 min-h-[4rem]">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isHoursTab = item.href.includes("#worker-hours");
          const active = isHoursTab
            ? pathname === "/dashboard" && hash === "#worker-hours"
            : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
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
