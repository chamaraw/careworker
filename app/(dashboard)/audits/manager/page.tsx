import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getManagerDashboardData,
  getManagerUpcomingComplianceRows,
  getManagerClockAttendanceSnapshot,
} from "./manager-actions";
import { ManagerDashboardClient } from "./manager-dashboard-client";

export default async function AuditManagerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");

  const [data, upcomingCompliance, clockAttendance] = await Promise.all([
    getManagerDashboardData(),
    getManagerUpcomingComplianceRows(),
    getManagerClockAttendanceSnapshot(),
  ]);

  return (
    <ManagerDashboardClient
      initialData={data}
      upcomingCompliance={upcomingCompliance}
      clockAttendance={clockAttendance}
    />
  );
}
