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
    update: { propertyId: property2.id },
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
    },
  });

  const serviceUser3 = await prisma.serviceUser.upsert({
    where: { id: "seed-service-user-3" },
    update: { propertyId: property1.id },
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

  console.log("Seed completed:", {
    admin: admin.email,
    workers: [careWorker1.email, careWorker2.email, careWorker3.email, careWorker4.email, careWorker5.email],
    serviceUsers: [serviceUser1.name, serviceUser2.name, serviceUser3.name],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
