/**
 * One-off script: set propertyId on any TimeRecord that has null.
 * Run after making propertyId required: npx tsx prisma/backfill-time-record-property.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const firstProperty = await prisma.property.findFirst({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!firstProperty) {
    console.log("No properties in database. Create a property first, then re-run.");
    process.exit(1);
  }

  // Raw update: set null propertyIds to the first property's id
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "TimeRecord"
    SET "propertyId" = $1
    WHERE "propertyId" IS NULL
  `, firstProperty.id);

  console.log(`Updated ${result} TimeRecord(s) with propertyId = ${firstProperty.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
