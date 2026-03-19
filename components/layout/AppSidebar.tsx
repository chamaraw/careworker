"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  UserCog,
  CalendarDays,
  ScrollText,
  BarChart3,
  LogOut,
  Menu,
  ListTodo,
  Banknote,
  CreditCard,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roster", label: "Roster", icon: Calendar },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/hours", label: "Hours", icon: Clock },
  { href: "/my-pay", label: "My Pay", icon: Receipt },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/follow-ups", label: "Follow-ups", icon: ListTodo },
  { href: "/service-users", label: "Service Users", icon: Users },
  { href: "/care-plans", label: "Care Plans", icon: FileText },
  { href: "/staff", label: "Staff", icon: UserCog, adminOnly: true },
  { href: "/rate-cards", label: "Rate Cards", icon: CreditCard, adminOnly: true },
  { href: "/payroll", label: "Payroll", icon: Banknote, adminOnly: true },
  { href: "/performance", label: "Performance", icon: BarChart3, adminOnly: true },
  { href: "/calendar", label: "Calendar Notes", icon: CalendarDays },
  { href: "/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 text-[0.9375rem] font-medium min-h-[2.75rem] min-w-[2.75rem] touch-manipulation",
        "transition-all duration-150 ease-out will-change-[transform,background-color]",
        "active:scale-[0.98] hover:bg-[var(--sidebar-accent)]",
        active
          ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] font-semibold shadow-sm"
          : "text-[var(--sidebar-foreground)] hover:text-[var(--sidebar-foreground)]"
      )}
    >
      <Icon className="size-5 shrink-0 opacity-90" aria-hidden />
      {label}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const items = navItems.filter((item) => !item.adminOnly || isAdmin);

  const nav = (
    <nav className="flex flex-col gap-0.5 px-2">
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))}
        />
      ))}
      <div className="my-2 border-t border-[var(--sidebar-border)]" />
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 rounded-xl px-4 py-3 text-[0.9375rem] text-[var(--sidebar-foreground)] min-h-[2.75rem] w-full justify-start touch-manipulation transition-all duration-150 ease-out active:scale-[0.98] hover:bg-[var(--sidebar-accent)]"
      >
        <LogOut className="size-5 shrink-0 opacity-90" aria-hidden />
        Sign out
      </button>
    </nav>
  );

  return (
    <>
      <aside className="hidden md:flex md:w-[15rem] md:flex-col md:fixed md:inset-y-0 md:left-0 z-40 bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] safe-area-pl transition-[background-color,border-color] duration-200 border-l-4 border-l-[var(--sidebar-brand-stripe)]">
        <div className="flex flex-col h-full w-full pt-6 pb-6">
          <div className="px-4 pb-5">
            <span className="text-[1.125rem] font-bold text-[var(--sidebar-foreground)] tracking-tight">
              FileyCare
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">{nav}</div>
        </div>
      </aside>
      <Sheet>
        <SheetTrigger
          className="md:hidden fixed top-4 left-4 z-50 safe-area-pt safe-area-pl flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-xl bg-[var(--sidebar)] border-2 border-[var(--sidebar-border)] shadow-[var(--shadow-soft)] text-[var(--sidebar-foreground)] transition-transform duration-150 active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[17rem] max-w-[85vw] p-0 bg-[var(--sidebar)] border-[var(--sidebar-border)] border-l-4 border-l-[var(--sidebar-brand-stripe)]">
          <div className="pt-16 pb-6 safe-area-pb">
            <div className="px-4 pb-5">
              <span className="text-[1.125rem] font-semibold text-[var(--sidebar-foreground)]">
                FileyCare
              </span>
            </div>
            {nav}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
