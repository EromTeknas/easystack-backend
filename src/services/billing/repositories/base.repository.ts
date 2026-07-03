// repositories/base.repository.ts

import { PrismaClient, Prisma } from "@prisma/client";

export abstract class BaseRepository {
  protected readonly prisma: PrismaClient | Prisma.TransactionClient;

  constructor(
    prisma: PrismaClient | Prisma.TransactionClient,
  ) {
    this.prisma = prisma;
  }
}