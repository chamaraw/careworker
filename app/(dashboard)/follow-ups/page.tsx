import { auth } from "@/lib/auth";
import { getFollowUpActions } from "./actions";
import { getServiceUsers } from "@/app/(dashboard)/roster/actions";
import { FollowUpsClient } from "./FollowUpsClient";

export default async function FollowUpsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [actions, serviceUsers] = await Promise.all([
    getFollowUpActions({}),
    getServiceUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Follow-up actions</h1>
        <p className="body-text-muted mt-1">
          Schedule and track follow-ups for people you support. They appear in shift notes so care workers can continue support.
        </p>
      </div>
      <FollowUpsClient
        initialActions={actions}
        serviceUsers={serviceUsers}
      />
    </div>
  );
}
