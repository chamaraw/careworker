import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Clock & timesheets for care workers live on the dashboard; admins use Payroll. */
export default async function HoursPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role === "ADMIN") {
    redirect("/payroll");
  }
  redirect("/dashboard#worker-hours");
}
