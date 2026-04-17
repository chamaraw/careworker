import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { getServiceUserDetail, getProperties, getCarePackagesForSelect } from "../../actions";
import { ServiceUserEditForm } from "../../ServiceUserEditForm";

export default async function EditServiceUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/service-users");
  const { id } = await params;
  const [user, properties, carePackages] = await Promise.all([
    getServiceUserDetail(id),
    getProperties(),
    getCarePackagesForSelect(),
  ]);
  if (!user) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit {user.name}</h1>
      <ServiceUserEditForm user={user} properties={properties} carePackages={carePackages} />
    </div>
  );
}
