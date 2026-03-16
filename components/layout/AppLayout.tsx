import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col md:flex-row">
      <AppSidebar />
      <div className="flex-1 flex flex-col md:pl-[15rem] min-w-0">
        <Header />
        <main className="flex-1 px-4 sm:px-5 py-5 pb-24 md:pb-6 safe-area-pb max-w-4xl mx-auto w-full min-h-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
