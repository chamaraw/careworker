import { auth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export async function Header() {
  const session = await auth();
  if (!session?.user) return null;
  const name = session.user.name ?? session.user.email ?? "User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <header className="sticky top-0 z-30 flex h-14 min-h-[3.5rem] items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm px-4 safe-area-pt md:pl-6">
      <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
        <span className="text-[0.9375rem] font-medium hidden sm:inline truncate max-w-[8rem] md:max-w-none">{name}</span>
        <Avatar className="size-9 rounded-full border border-[var(--border)] shadow-[var(--shadow-soft)]">
          <AvatarFallback className="text-xs bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
