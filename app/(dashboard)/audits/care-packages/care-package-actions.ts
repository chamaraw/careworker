"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN") throw new Error("Admin only");
  return session;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function assertValidCarePackageSlug(slug: string) {
  const s = slug.trim().toLowerCase();
  if (!SLUG_RE.test(s)) {
    throw new Error("Slug must be lowercase with hyphens only (e.g. supported-living, diabetes).");
  }
  return s;
}

export async function getCarePackagesAdminData() {
  noStore();
  await requireAdmin();
  const [packages, linkableTemplates] = await Promise.all([
    prisma.carePackage.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        templates: { select: { formTemplateId: true } },
      },
    }),
    prisma.auditFormTemplate.findMany({
      /** Link per-property or care-package–scoped audits to pathways. Globals apply everywhere already; person-only is assigned on the service user profile. */
      where: { isActive: true, assignmentScope: { in: ["PROPERTY", "CARE_PACKAGE"] } },
      select: { id: true, name: true, category: true, assignmentScope: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    packages: packages.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      linkedTemplateIds: p.templates.map((t) => t.formTemplateId),
    })),
    linkableTemplates,
  };
}

export async function createCarePackage(data: {
  slug: string;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
}) {
  await requireAdmin();
  const slug = assertValidCarePackageSlug(data.slug);
  const name = data.name.trim();
  if (!name) throw new Error("Name is required.");
  const created = await prisma.carePackage.create({
    data: {
      slug,
      name,
      description: data.description?.trim() ? data.description.trim() : null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
    select: { id: true },
  });
  revalidatePath("/audits/care-packages");
  revalidatePath("/service-users");
  return created;
}

export async function updateCarePackage(
  id: string,
  data: Partial<{
    slug: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
) {
  await requireAdmin();
  const pkg = await prisma.carePackage.findUnique({ where: { id }, select: { id: true } });
  if (!pkg) throw new Error("Care package not found");
  const update: Record<string, unknown> = {};
  if (data.slug !== undefined) update.slug = assertValidCarePackageSlug(data.slug);
  if (data.name !== undefined) {
    const n = data.name.trim();
    if (!n) throw new Error("Name is required.");
    update.name = n;
  }
  if (data.description !== undefined) update.description = data.description?.trim() ? data.description.trim() : null;
  if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  await prisma.carePackage.update({ where: { id }, data: update });
  revalidatePath("/audits/care-packages");
  revalidatePath("/service-users");
  revalidatePath("/audits/property");
  revalidatePath("/audits/manager");
  revalidatePath("/audits/recording");
}

export async function updateCarePackageTemplateLinks(
  carePackageId: string,
  formTemplateIds: string[]
): Promise<{ ok: true; linkedCount: number }> {
  await requireAdmin();
  const pkg = await prisma.carePackage.findUnique({ where: { id: carePackageId } });
  if (!pkg) throw new Error("Care package not found");
  const unique = Array.from(new Set(formTemplateIds.filter(Boolean)));
  if (unique.length > 0) {
    const valid = await prisma.auditFormTemplate.findMany({
      where: {
        id: { in: unique },
        isActive: true,
        assignmentScope: { in: ["PROPERTY", "CARE_PACKAGE"] },
      },
      select: { id: true },
    });
    const ok = new Set(valid.map((v) => v.id));
    for (const id of unique) {
      if (!ok.has(id)) {
        throw new Error(
          "Every linked template must be active and use assignment “Per property” or “Care package” in Templates (not organisation-wide or person-only)."
        );
      }
    }
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.carePackageTemplate.deleteMany({ where: { carePackageId } });
      for (const formTemplateId of unique) {
        await tx.carePackageTemplate.create({ data: { carePackageId, formTemplateId } });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not save linked audits: ${msg}`);
  }
  revalidatePath("/audits/care-packages");
  revalidatePath("/audits/property");
  revalidatePath("/audits/manager");
  revalidatePath("/audits/recording");
  revalidatePath("/service-users");
  return { ok: true, linkedCount: unique.length };
}
