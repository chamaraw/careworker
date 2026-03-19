"use client";

/**
 * Full-viewport wrapper for the salary slip so it covers app chrome (sidebar, header, bottom nav).
 * Gives a clear, dedicated slip view that works on iPad and desktop.
 */
export function SlipFullView({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-stone-50 overflow-auto"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="min-h-full py-6 px-4 sm:py-8 sm:px-6 md:py-10 md:px-8 flex justify-center">
        {children}
      </div>
    </div>
  );
}
