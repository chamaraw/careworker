import { auth } from "@/lib/auth";
import { NotificationBell } from "./NotificationBell";
import { ProfileMenu } from "./ProfileMenu";

export async function Header() {
  const session = await auth();
  if (!session?.user) return null;
  const name = session.user.name ?? session.user.email ?? "User";
  const email = session.user.email ?? "";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 flex h-14 min-h-[3.5rem] items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm px-4 safe-area-pt md:pl-6">
      <div className="flex items-center gap-2 sm:gap-3 text-[var(--muted-foreground)]">
        <NotificationBell isAdmin={isAdmin} />
        <ProfileMenu name={name} email={email} initials={initials} isAdmin={isAdmin} />
      </div>
    </header>
  );
}
