import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ServiceUserForm } from "../ServiceUserForm";
import { getProperties, getCarePackagesForSelect } from "../actions";

export default async function NewServiceUserPage() {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/service-users");
  const [properties, carePackages] = await Promise.all([getProperties(), getCarePackagesForSelect()]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add service user</h1>
      <ServiceUserForm properties={properties} carePackages={carePackages} />
    </div>
  );
}
