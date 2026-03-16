import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StaffEditForm } from "../../StaffEditForm";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/staff");
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id, role: "CARE_WORKER" },
  });
  if (!user) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit {user.name}</h1>
      <StaffEditForm user={{ id: user.id, name: user.name, phone: user.phone, qualifications: user.qualifications, active: user.active }} />
    </div>
  );
}
