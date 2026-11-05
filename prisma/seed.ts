import { PrismaClient } from "@prisma/client";

import { seedAuthorization } from "./seeders/authorization.seeder";
import { seedBillingFeatures } from "./seeders/billing-features.seeder";
import { seedBillingQuotas } from "./seeders/billing-quotas.seeder";
import { seedBillingPlans } from "./seeders/billing-plans.seeder";
import { seedUsers } from "./seeders/users.seeder";
import { seedTravelAgency } from "./seeders/travel-agency.seeder";

const prisma = new PrismaClient();

async function main() {
  const seedUsersFlag = process.argv.includes("--users");
  const seedTravelFlag = process.argv.includes("--travel") || process.argv.includes("--users");

  console.log("");
  console.log("======================================");
  console.log("Starting Database Seeding");
  console.log("======================================");

  await seedAuthorization(prisma);

  await seedBillingFeatures(prisma);

  await seedBillingQuotas(prisma);

  await seedBillingPlans(prisma);

  if (seedUsersFlag) {
    await seedUsers(prisma);
  }

  if (seedTravelFlag) {
    await seedTravelAgency(prisma);
  }

  console.log("");
  console.log("======================================");
  console.log("Database Seeded Successfully");
  console.log("======================================");

  // ADD THIS LINE
  process.exit(0);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });