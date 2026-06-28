import { PrismaClient } from "@prisma/client";
import { seedAuthorization } from "./seeders/authorization.seeder";
import { seedPlans } from "./seeders/plans.seeder";

const prisma = new PrismaClient();

async function main() {
  await seedAuthorization(prisma);
  await seedPlans(prisma);
}

seedAuthorization(prisma)
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });