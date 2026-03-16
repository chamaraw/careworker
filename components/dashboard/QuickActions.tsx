"use client";

import Link from "next/link";
import { Calendar, BookOpen, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { href: "/roster", label: "View Roster", icon: Calendar },
  { href: "/journal", label: "Add Journal Entry", icon: BookOpen },
  { href: "/hours", label: "Clock In/Out", icon: Clock },
  { href: "/incidents", label: "Report Incident", icon: AlertTriangle },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href}>
            <Button
              variant="outline"
              className="w-full min-h-[48px] text-base gap-2 touch-manipulation"
              size="lg"
            >
              <Icon className="size-5" aria-hidden />
              {action.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
