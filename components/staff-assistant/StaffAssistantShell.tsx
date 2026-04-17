"use client";

import { StaffAssistantProvider } from "@/components/staff-assistant/staff-assistant-context";
import { StaffAssistantFAB } from "@/components/staff-assistant/StaffAssistantFAB";
import { StaffAssistantDrawer } from "@/components/staff-assistant/StaffAssistantDrawer";

export function StaffAssistantShell({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <StaffAssistantProvider>
      {children}
      <StaffAssistantFAB />
      <StaffAssistantDrawer />
    </StaffAssistantProvider>
  );
}
