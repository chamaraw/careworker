import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, setHours, setMinutes } from "date-fns";

// Uses DATABASE_URL from .env (Neon Postgres or any PostgreSQL).
// Ensure schema is applied first: npx prisma db push   or   npx prisma migrate deploy
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

async function main() {
  const hashedPassword = bcrypt.hashSync("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@fileycare.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "admin@fileycare.com",
      passwordHash: hashedPassword,
      name: "Admin User",
      role: "ADMIN",
      active: true,
    },
  });

  const managerAdmin = await prisma.user.upsert({
    where: { email: "manager@fileycare.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "manager@fileycare.com",
      passwordHash: hashedPassword,
      name: "Audit Manager",
      role: "ADMIN",
      active: true,
    },
  });

  const careWorker1 = await prisma.user.upsert({
    where: { email: "worker@fileycare.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "worker@fileycare.com",
      passwordHash: hashedPassword,
      name: "Jane Care Worker",
      phone: "07700 900000",
      role: "CARE_WORKER",
      qualifications: "NVQ Level 2",
      active: true,
    },
  });

  const careWorker2 = await prisma.user.upsert({
    where: { email: "worker2@fileycare.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "worker2@fileycare.com",
      passwordHash: hashedPassword,
      name: "Bob Support",
      phone: "07700 900002",
      role: "CARE_WORKER",
      qualifications: "NVQ Level 3",
      active: true,
    },
  });

  const careWorker3 = await prisma.user.upsert({
    where: { email: "worker3@fileycare.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "worker3@fileycare.com",
      passwordHash: hashedPassword,
      name: "Priya Sharma",
      phone: "07700 900003",
      role: "CARE_WORKER",
      qualifications: "NVQ Level 2",
      active: true,
    },
  });

  const careWorker4 = await prisma.user.upsert({
    where: { email: "worker4@fileycare.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "worker4@fileycare.com",
      passwordHash: hashedPassword,
      name: "Mike Johnson",
      phone: "07700 900004",
      role: "CARE_WORKER",
      qualifications: "NVQ Level 3",
      active: true,
    },
  });

  const careWorker5 = await prisma.user.upsert({
    where: { email: "worker5@fileycare.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "worker5@fileycare.com",
      passwordHash: hashedPassword,
      name: "Sarah Williams",
      phone: "07700 900005",
      role: "CARE_WORKER",
      qualifications: "NVQ Level 2",
      active: true,
    },
  });

  const property1 = await prisma.property.upsert({
    where: { id: "seed-property-1" },
    update: {},
    create: {
      id: "seed-property-1",
      name: "Filey Care Home",
      address: "1 Care Home Lane, Filey",
    },
  });

  const property2 = await prisma.property.upsert({
    where: { id: "seed-property-2" },
    update: {},
    create: {
      id: "seed-property-2",
      name: "Supported Living North",
      address: "2 Supported Living Rd, Filey",
    },
  });

  const carePackageDefs = [
    {
      id: "seed-care-pkg-diabetes",
      slug: "diabetes",
      name: "Diabetes support",
      description: "Blood glucose and diabetes-related monitoring / audits.",
      sortOrder: 10,
    },
    {
      id: "seed-care-pkg-parkinsons",
      slug: "parkinsons",
      name: "Parkinson’s support",
      description: "Parkinson’s pathway forms and reviews.",
      sortOrder: 20,
    },
    {
      id: "seed-care-pkg-dementia",
      slug: "dementia",
      name: "Dementia care",
      description: "Cognitive support and dementia-specific records.",
      sortOrder: 30,
    },
    {
      id: "seed-care-pkg-residential",
      slug: "residential_care",
      name: "Residential care home",
      description: "Typical nursing / residential care home service users.",
      sortOrder: 40,
    },
    {
      id: "seed-care-pkg-supported_living",
      slug: "supported_living",
      name: "Supported living",
      description: "Community supported living pathway.",
      sortOrder: 50,
    },
    {
      id: "seed-care-pkg-learning_disability",
      slug: "learning_disability",
      name: "Learning disability",
      description: "Learning disability and autism support pathway.",
      sortOrder: 60,
    },
    {
      id: "seed-care-pkg-palliative",
      slug: "palliative",
      name: "Palliative / end of life",
      description: "Palliative care documentation.",
      sortOrder: 70,
    },
    {
      id: "seed-care-pkg-general",
      slug: "general",
      name: "General",
      description: "No specific clinical pathway — standard audits only.",
      sortOrder: 100,
    },
  ] as const;

  for (const cp of carePackageDefs) {
    await prisma.carePackage.upsert({
      where: { slug: cp.slug },
      update: { name: cp.name, description: cp.description, sortOrder: cp.sortOrder },
      create: {
        id: cp.id,
        slug: cp.slug,
        name: cp.name,
        description: cp.description,
        sortOrder: cp.sortOrder,
      },
    });
  }

  const serviceUser1 = await prisma.serviceUser.upsert({
    where: { id: "seed-service-user-1" },
    update: { propertyId: property1.id },
    create: {
      id: "seed-service-user-1",
      name: "John Smith",
      dateOfBirth: new Date("1950-05-15"),
      address: "1 Care Home Lane, Filey",
      propertyId: property1.id,
      allergies: "Penicillin",
      medicalNotes: "Mobility support required.",
      emergencyContactName: "Mary Smith",
      emergencyContactPhone: "07700 900001",
      careNeedsLevel: "medium",
    },
  });

  const serviceUser2 = await prisma.serviceUser.upsert({
    where: { id: "seed-service-user-2" },
    update: { propertyId: property2.id, carePackageId: "seed-care-pkg-diabetes" },
    create: {
      id: "seed-service-user-2",
      name: "Alice Brown",
      dateOfBirth: new Date("1962-08-20"),
      address: "2 Supported Living Rd, Filey",
      propertyId: property2.id,
      allergies: "None",
      medicalNotes: "Diabetes – monitor blood sugar.",
      emergencyContactName: "Tom Brown",
      emergencyContactPhone: "07700 900003",
      careNeedsLevel: "high",
      carePackageId: "seed-care-pkg-diabetes",
    },
  });

  const serviceUser3 = await prisma.serviceUser.upsert({
    where: { id: "seed-service-user-3" },
    update: { propertyId: property1.id, carePackageId: "seed-care-pkg-residential" },
    create: {
      id: "seed-service-user-3",
      name: "Fred Wilson",
      dateOfBirth: new Date("1948-12-10"),
      address: "1 Care Home Lane, Filey",
      propertyId: property1.id,
      allergies: "None",
      medicalNotes: "Light support.",
      emergencyContactName: "Jean Wilson",
      emergencyContactPhone: "07700 900004",
      careNeedsLevel: "low",
      carePackageId: "seed-care-pkg-residential",
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingShiftCount = await prisma.shift.count();
  if (existingShiftCount === 0) {
    const workers = [careWorker1, careWorker2, careWorker3, careWorker4, careWorker5];
    const serviceUsers = [
      { su: serviceUser1, level: "medium" as const },
      { su: serviceUser2, level: "high" as const },
      { su: serviceUser3, level: "low" as const },
    ];
    const props = [property1, property2, property1];

    for (let d = -28; d <= 2; d++) {
      const day = addDays(today, d);
      for (let w = 0; w < workers.length; w++) {
        const worker = workers[w];
        const { su, level } = serviceUsers[w % serviceUsers.length];
        const prop = props[w % props.length];
        const completed = d < 0 && (w + d) % 3 !== 1;
        await prisma.shift.create({
          data: {
            careWorkerId: worker.id,
            serviceUserId: su.id,
            propertyId: prop.id,
            startAt: setMinutes(setHours(day, 8), 0),
            endAt: setMinutes(setHours(day, 16), 0),
            status: completed ? "COMPLETED" : "SCHEDULED",
            notes: level + " care",
          },
        });
      }
    }
  }

  const journalCount = await prisma.journalEntry.count();
  if (journalCount === 0) {
    const completedShiftsAll = await prisma.shift.findMany({
      where: { status: "COMPLETED" },
      take: 60,
    });
    for (const shift of completedShiftsAll) {
      await prisma.journalEntry.create({
        data: {
          shiftId: shift.id,
          careWorkerId: shift.careWorkerId,
          category: "ROUTINE",
          content: "Care tasks completed. Client comfortable.",
        },
      });
      if (completedShiftsAll.indexOf(shift) % 2 === 0) {
        await prisma.journalEntry.create({
          data: {
            shiftId: shift.id,
            careWorkerId: shift.careWorkerId,
            category: "MEAL",
            content: "Meal support given.",
          },
        });
      }
    }
  }

  const incidentCount = await prisma.incidentReport.count();
  if (incidentCount === 0) {
    await prisma.incidentReport.create({
      data: {
        serviceUserId: serviceUser1.id,
        careWorkerId: careWorker1.id,
        severity: "LOW",
        status: "RESOLVED",
        description: "Minor trip in hallway. No injury.",
        actionTaken: "Checked for injury, incident form completed.",
        followUpNotes: "Risk assessment reviewed.",
      },
    });
    await prisma.incidentReport.create({
      data: {
        serviceUserId: serviceUser2.id,
        careWorkerId: careWorker3.id,
        severity: "LOW",
        status: "RESOLVED",
        description: "Medication given 10 min late. Noted.",
        actionTaken: "Apology to family. Process reviewed.",
        followUpNotes: "No recurrence.",
      },
    });
  }

  const carePlanCount = await prisma.carePlan.count();
  if (carePlanCount === 0) {
    await prisma.carePlan.create({
      data: {
        serviceUserId: serviceUser1.id,
        title: "Personal care and mobility",
        goals: "Maintain independence with daily activities. Support mobility and medication.",
        interventions: "Daily support with washing, dressing. Prompt medication. Encourage gentle exercise.",
        reviewDate: addDays(today, 90),
        status: "ACTIVE",
      },
    });
  }

  const timeRecordCount = await prisma.timeRecord.count();
  if (timeRecordCount === 0) {
    const completedShiftsForTime = await prisma.shift.findMany({
      where: { status: "COMPLETED", propertyId: { not: null } },
    });
    for (const shift of completedShiftsForTime) {
      if (!shift.propertyId) continue;
      const start = shift.startAt;
      const end = shift.endAt;
      const totalMins = Math.round((end.getTime() - start.getTime()) / 60000) - 30;
      await prisma.timeRecord.create({
        data: {
          userId: shift.careWorkerId,
          propertyId: shift.propertyId,
          shiftType: "STANDARD",
          clockInAt: start,
          clockOutAt: end,
          breakMinutes: 30,
          totalMinutes: totalMins,
          approvalStatus: "APPROVED",
        },
      });
    }
  }

  await seedUkStaffCompetencyFramework();

  console.log("Seed completed:", {
    admin: admin.email,
    managerAdmin: managerAdmin.email,
    workers: [careWorker1.email, careWorker2.email, careWorker3.email, careWorker4.email, careWorker5.email],
    serviceUsers: [serviceUser1.name, serviceUser2.name, serviceUser3.name],
  });
}

/** Idempotent: Skills for Care–style statutory/mandatory topics + pathway profiles (England adult social care). */
async function seedUkStaffCompetencyFramework() {
  const coreReqs = [
    { code: "health_safety", name: "Health and safety at work", category: "Statutory", renewalMonths: 12 },
    { code: "fire_safety", name: "Fire safety", category: "Statutory", renewalMonths: 12 },
    { code: "infection_control", name: "Infection prevention and control", category: "Mandatory", renewalMonths: 12 },
    { code: "moving_handling", name: "Moving and handling", category: "Mandatory", renewalMonths: 12 },
    { code: "safeguarding_adults", name: "Safeguarding adults", category: "Statutory", renewalMonths: 12 },
    { code: "bls_first_aid", name: "Basic life support / first aid awareness", category: "Mandatory", renewalMonths: 12 },
    { code: "mca_dols", name: "Mental Capacity Act & DoLS awareness", category: "Statutory", renewalMonths: 12 },
    { code: "eq_diversity", name: "Equality, diversity and human rights", category: "Mandatory", renewalMonths: 24 },
    { code: "information_governance", name: "Information governance (GDPR)", category: "Mandatory", renewalMonths: 12 },
    { code: "food_hygiene", name: "Food hygiene (where food handled)", category: "Mandatory", renewalMonths: 12 },
  ] as const;

  const pathwayReqs = [
    {
      code: "medication_admin",
      name: "Medication administration and handling",
      category: "Clinical",
      renewalMonths: 6,
    },
    { code: "insulin_awareness", name: "Diabetes / insulin awareness", category: "Clinical", renewalMonths: 12 },
    {
      code: "pbs_ld",
      name: "Positive behaviour support (LD / autism)",
      category: "Clinical",
      renewalMonths: 12,
    },
    {
      code: "dementia_interaction",
      name: "Dementia care and interaction",
      category: "Clinical",
      renewalMonths: 12,
    },
  ] as const;

  const reqIdByCode = new Map<string, string>();

  for (const d of coreReqs) {
    const existing = await prisma.trainingRequirement.findFirst({ where: { code: d.code } });
    if (existing) {
      reqIdByCode.set(d.code, existing.id);
      continue;
    }
    const row = await prisma.trainingRequirement.create({
      data: {
        code: d.code,
        name: d.name,
        category: d.category,
        renewalMonths: d.renewalMonths,
        appliesToAllStaff: true,
        isMandatory: true,
        isActive: true,
      },
    });
    reqIdByCode.set(d.code, row.id);
  }

  for (const d of pathwayReqs) {
    const existing = await prisma.trainingRequirement.findFirst({ where: { code: d.code } });
    if (existing) {
      reqIdByCode.set(d.code, existing.id);
      continue;
    }
    const row = await prisma.trainingRequirement.create({
      data: {
        code: d.code,
        name: d.name,
        category: d.category,
        renewalMonths: d.renewalMonths,
        appliesToAllStaff: false,
        isMandatory: true,
        isActive: true,
      },
    });
    reqIdByCode.set(d.code, row.id);
  }

  type Prof = {
    id: string;
    slug: string;
    name: string;
    description: string;
    sortOrder: number;
    codes: string[];
  };

  const profiles: Prof[] = [
    {
      id: "seed-prof-medication",
      slug: "medication_competent",
      name: "Medication competent",
      description: "Can administer or support medicines under organisational policy.",
      sortOrder: 10,
      codes: ["medication_admin"],
    },
    {
      id: "seed-prof-diabetes",
      slug: "diabetes_support",
      name: "Diabetes support",
      description: "Supports service users with diabetes and glucose monitoring.",
      sortOrder: 20,
      codes: ["insulin_awareness", "medication_admin"],
    },
    {
      id: "seed-prof-ld",
      slug: "ld_autism_pathway",
      name: "Learning disability & autism",
      description: "PBS and LD / autism pathway.",
      sortOrder: 30,
      codes: ["pbs_ld"],
    },
    {
      id: "seed-prof-dementia",
      slug: "dementia_pathway",
      name: "Dementia care pathway",
      description: "Dementia-aware practice.",
      sortOrder: 40,
      codes: ["dementia_interaction"],
    },
  ];

  for (const p of profiles) {
    await prisma.competencyProfile.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description, sortOrder: p.sortOrder },
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        sortOrder: p.sortOrder,
      },
    });
    const prof = await prisma.competencyProfile.findUniqueOrThrow({ where: { slug: p.slug } });
    await prisma.competencyProfileRequirement.deleteMany({ where: { competencyProfileId: prof.id } });
    for (const code of p.codes) {
      const rid = reqIdByCode.get(code);
      if (rid) {
        await prisma.competencyProfileRequirement.create({
          data: { competencyProfileId: prof.id, requirementId: rid },
        });
      }
    }
  }

  const pkgLinks: Array<{ carePackageId: string; profileSlug: string }> = [
    { carePackageId: "seed-care-pkg-diabetes", profileSlug: "diabetes_support" },
    { carePackageId: "seed-care-pkg-dementia", profileSlug: "dementia_pathway" },
    { carePackageId: "seed-care-pkg-learning_disability", profileSlug: "ld_autism_pathway" },
  ];

  for (const link of pkgLinks) {
    const prof = await prisma.competencyProfile.findUnique({ where: { slug: link.profileSlug } });
    if (!prof) continue;
    const existing = await prisma.carePackageCompetencyProfile.findFirst({
      where: { carePackageId: link.carePackageId, competencyProfileId: prof.id },
    });
    if (!existing) {
      await prisma.carePackageCompetencyProfile.create({
        data: { carePackageId: link.carePackageId, competencyProfileId: prof.id },
      });
    }
  }

  const demo = await prisma.user.findUnique({ where: { email: "worker@fileycare.com" } });
  if (demo) {
    const med = await prisma.competencyProfile.findUnique({ where: { slug: "medication_competent" } });
    const dia = await prisma.competencyProfile.findUnique({ where: { slug: "diabetes_support" } });
    if (med && dia) {
      const count = await prisma.userCompetencyProfile.count({ where: { userId: demo.id } });
      if (count === 0) {
        await prisma.userCompetencyProfile.createMany({
          data: [
            { userId: demo.id, competencyProfileId: med.id },
            { userId: demo.id, competencyProfileId: dia.id },
          ],
        });
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
