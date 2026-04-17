"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Receipt, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileMenu({
  name,
  email,
  initials,
  isAdmin,
}: {
  name: string;
  email: string;
  initials: string;
  isAdmin: boolean;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex max-w-[min(100%,18rem)] items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-[var(--muted-foreground)] outline-none transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] min-h-[44px] touch-manipulation"
        aria-label="Open profile menu"
      >
        <span className="hidden min-w-0 truncate text-[0.9375rem] font-medium sm:inline">{name}</span>
        <Avatar className="size-9 shrink-0 rounded-full border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <AvatarFallback className="text-xs bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[14rem]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5 py-0.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <User className="size-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{name}</span>
              </span>
              <span className="truncate pl-6 text-xs text-[var(--muted-foreground)]">{email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {!isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="min-h-[44px] gap-2 cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  router.push("/my-pay");
                }}
              >
                <Receipt className="size-4 shrink-0" aria-hidden />
                My Pay
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-[44px] gap-2 cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            void signOut({ callbackUrl: "/login" });
          }}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
