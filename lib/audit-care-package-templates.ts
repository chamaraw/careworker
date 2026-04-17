import { prisma } from "@/lib/prisma";
import type { TemplateWithFields } from "@/lib/audit-effective-templates";

export type CarePackageTemplateRow = TemplateWithFields & { category: string | null };

/** Active templates linked to each service user’s care package (deduped by template id). */
export async function loadCarePackageTemplatesByServiceUserId(
  serviceUserIds: string[]
): Promise<Map<string, CarePackageTemplateRow[]>> {
  const result = new Map<string, CarePackageTemplateRow[]>();
  for (const id of serviceUserIds) {
    result.set(id, []);
  }
  if (serviceUserIds.length === 0) return result;

  const users = await prisma.serviceUser.findMany({
    where: { id: { in: serviceUserIds } },
    select: { id: true, carePackageId: true },
  });

  const packageIds = Array.from(
    new Set(users.map((u) => u.carePackageId).filter((x): x is string => Boolean(x)))
  );
  if (packageIds.length === 0) return result;

  const links = await prisma.carePackageTemplate.findMany({
    where: { carePackageId: { in: packageIds } },
    include: {
      formTemplate: {
        select: {
          id: true,
          name: true,
          fields: true,
          category: true,
          isActive: true,
          assignmentScope: true,
        },
      },
    },
  });

  const byPackage = new Map<string, Map<string, CarePackageTemplateRow>>();
  for (const link of links) {
    const t = link.formTemplate;
    if (!t.isActive) continue;
    let m = byPackage.get(link.carePackageId);
    if (!m) {
      m = new Map();
      byPackage.set(link.carePackageId, m);
    }
    m.set(t.id, {
      id: t.id,
      name: t.name,
      fields: t.fields,
      category: t.category,
    });
  }

  for (const u of users) {
    if (!u.carePackageId) continue;
    const m = byPackage.get(u.carePackageId);
    result.set(u.id, m ? Array.from(m.values()) : []);
  }

  return result;
}
