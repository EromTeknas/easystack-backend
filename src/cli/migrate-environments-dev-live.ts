import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function runMigration() {
  console.log('Starting Environment standardization migration (development -> dev, production -> live)...');

  // 1. Migrate MySQL Environment table
  const updatedDev = await prisma.environment.updateMany({
    where: { name: 'development' },
    data: { name: 'dev', displayName: 'Dev' },
  });
  console.log(`Updated ${updatedDev.count} 'development' environments to 'dev' in MySQL.`);

  const updatedLive = await prisma.environment.updateMany({
    where: { name: 'production' },
    data: { name: 'live', displayName: 'Live' },
  });
  console.log(`Updated ${updatedLive.count} 'production' environments to 'live' in MySQL.`);

  // Also ensure any existing 'dev' and 'live' rows have displayName set
  await prisma.environment.updateMany({
    where: { name: 'dev', displayName: null },
    data: { displayName: 'Dev' },
  });
  await prisma.environment.updateMany({
    where: { name: 'live', displayName: null },
    data: { displayName: 'Live' },
  });

  // 2. Connect to MongoDB and migrate schema blueprints and content entries
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is required to run migration.');
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Failed to obtain MongoDB db instance');
  }

  // A. Migrate schemablueprints
  const blueprints = await db.collection('schemablueprints').find({}).toArray();
  let bpUpdatedCount = 0;

  for (const bp of blueprints) {
    let changed = false;
    let envs = Array.isArray(bp.environments) ? [...bp.environments] : [];
    let envVers = bp.environmentVersions ? { ...bp.environmentVersions } : {};

    // Standardize environments array
    if (envs.includes('development')) {
      envs = envs.map((e) => (e === 'development' ? 'dev' : e));
      changed = true;
    }
    if (envs.includes('production')) {
      envs = envs.map((e) => (e === 'production' ? 'live' : e));
      changed = true;
    }
    // Remove duplicates
    envs = Array.from(new Set(envs));

    // Standardize environmentVersions map
    if (envVers['development'] !== undefined) {
      if (envVers['dev'] === undefined) {
        envVers['dev'] = envVers['development'];
      }
      delete envVers['development'];
      changed = true;
    }
    if (envVers['production'] !== undefined) {
      if (envVers['live'] === undefined) {
        envVers['live'] = envVers['production'];
      }
      delete envVers['production'];
      changed = true;
    }

    if (changed) {
      await db.collection('schemablueprints').updateOne(
        { _id: bp._id },
        {
          $set: {
            environments: envs,
            environmentVersions: envVers,
          },
        }
      );
      bpUpdatedCount++;
    }
  }
  console.log(`Migrated ${bpUpdatedCount} schema blueprints in MongoDB.`);

  // B. Migrate contententries
  const entriesDevResult = await db.collection('contententries').updateMany(
    { environment: 'development' },
    { $set: { environment: 'dev' } }
  );
  console.log(`Migrated ${entriesDevResult.modifiedCount} content entries from 'development' to 'dev'.`);

  const entriesLiveResult = await db.collection('contententries').updateMany(
    { environment: 'production' },
    { $set: { environment: 'live' } }
  );
  console.log(`Migrated ${entriesLiveResult.modifiedCount} content entries from 'production' to 'live'.`);

  console.log('Environment standardization migration completed successfully!');
  await mongoose.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
