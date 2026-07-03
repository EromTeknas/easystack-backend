import { BaseRepository } from "./base.repository";

export class UsageRepository extends BaseRepository {
  findByQuotaKey(userId: number, quotaKey: string) {
    return this.prisma.usage.findFirst({
      where: {
        userId,
        quota: {
          key: quotaKey,
        },
      },
    });
  }

  initialize(userId: number, quotaKey: string) {
    this.findByQuotaKey(userId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Quota not found for userId ${userId} and quotaKey ${quotaKey}`,
        );
      }
      return this.prisma.usage.upsert({
        where: {
          userId_quotaId: {
            userId,
            quotaId: quota.id,
          },
        },
        update: {},
        create: {
          userId,
          quotaId: quota.id,
          value: 0,
        },
      });
    });
  }

  increment(userId: number, quotaKey: string, value: number) {
    this.findByQuotaKey(userId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for userId ${userId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.update({
        where: {
          userId_quotaId: {
            userId,
            quotaId: quota.id,
          },
        },
        data: {
          value: {
            increment: value,
          },
        },
      });
    });
  }

  decrement(userId: number, quotaKey: string, value: number) {
    this.findByQuotaKey(userId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for userId ${userId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.update({
        where: {
          userId_quotaId: {
            userId,
            quotaId: quota.id,
          },
        },
        data: {
          value: {
            decrement: value,
          },
        },
      });
    });
  }

  reset(userId: number, quotaKey: string) {
    this.findByQuotaKey(userId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for userId ${userId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.update({
        where: {
          userId_quotaId: {
            userId,
            quotaId: quota.id,
          },
        },
        data: {
          value: 0,
        },
      });
    });
  }

  delete(userId: number, quotaKey: string) {
    this.findByQuotaKey(userId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for userId ${userId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.delete({
        where: {
          userId_quotaId: {
            userId,
            quotaId: quota.id,
          },
        },
      });
    });
  }

  listUserUsage(userId: number) {
    return this.prisma.usage.findMany({
      where: {
        userId,
      },
      include: {
        quota: true,
      },
    });
  }
}
