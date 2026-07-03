import { BaseRepository } from "./base.repository";
import { QuotaResetPolicy } from "@prisma/client";
export class QuotaRepository extends BaseRepository {
  findByKey(key: string) {
    return this.prisma.quota.findUnique({
      where: { key },
    });
  }

  findMany() {
    return this.prisma.quota.findMany();
  }

  findManyByKeys(keys: string[]) {
    return this.prisma.quota.findMany({
      where: {
        key: {
          in: keys,
        },
      },
    });
  }

  listResettable() {
    return this.prisma.quota.findMany({
      where: {
        resetPolicy: {
          not: QuotaResetPolicy.NEVER,
        },
      },
    });
  }

  listByResetPolicy(resetPolicy: QuotaResetPolicy) {
    return this.prisma.quota.findMany({
      where: {
        resetPolicy,
      },
    });
  }


}