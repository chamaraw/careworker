"use client";

import Link from "next/link";
import { Calendar, BookOpen, Clock, AlertTriangle, ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const baseActions = (hoursHref: string) => [
  { href: "/roster", label: "Roster", icon: Calendar },
  { href: "/audits/recording", label: "Audit recording", icon: ClipboardList },
  { href: hoursHref, label: "Hours & clock", icon: Clock },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/notes", label: "Notes", icon: BookOpen },
];

export function QuickActions({
  /** Care workers: in-page anchor on the dashboard; admins: payroll / timesheets. */
  hoursHref = "#worker-hours",
}: {
  hoursHref?: string;
}) {
  const actions = baseActions(hoursHref);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "h-auto min-h-[72px] sm:min-h-[76px] w-full min-w-0 overflow-hidden px-2 py-2.5 sm:px-3 sm:py-3 text-sm shadow-sm touch-manipulation inline-flex flex-col items-center justify-center gap-1.5 text-center leading-tight"
            )}
          >
            <Icon className="size-5 shrink-0 text-[#005EB8]" aria-hidden />
            <span className="w-full max-w-[11rem] sm:max-w-none text-balance break-words hyphens-auto">
              {action.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
