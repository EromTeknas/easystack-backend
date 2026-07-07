import { BaseRepository } from "./base.repository";

export class UsageRepository extends BaseRepository {
  findByQuotaKey(workspaceId: number, quotaKey: string) {
    return this.prisma.usage.findFirst({
      where: {
        workspaceId,
        quota: {
          key: quotaKey,
        },
      },
      include: {
        quota: true,
      },
    });
  }

  initialize(workspaceId: number, quotaKey: string) {
    this.findByQuotaKey(workspaceId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Quota not found for workspaceId ${workspaceId} and quotaKey ${quotaKey}`,
        );
      }
      return this.prisma.usage.upsert({
        where: {
          workspaceId_quotaId: {
            workspaceId,
            quotaId: quota.quotaId,
          },
        },
        update: {},
        create: {
          workspaceId,
          quotaId: quota.quotaId,
          value: 0,
        },
      });
    });
  }

  increment(workspaceId: number, quotaKey: string, value: number) {
    this.findByQuotaKey(workspaceId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for workspaceId ${workspaceId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.update({
        where: {
          workspaceId_quotaId: {
            workspaceId,
            quotaId: quota.quotaId,
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

  decrement(workspaceId: number, quotaKey: string, value: number) {
    this.findByQuotaKey(workspaceId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for workspaceId ${workspaceId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.update({
        where: {
          workspaceId_quotaId: {
            workspaceId,
            quotaId: quota.quotaId,
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

  reset(workspaceId: number, quotaKey: string) {
    this.findByQuotaKey(workspaceId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for workspaceId ${workspaceId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.update({
        where: {
          workspaceId_quotaId: {
            workspaceId,
            quotaId: quota.quotaId,
          },
        },
        data: {
          value: 0,
        },
      });
    });
  }

  delete(workspaceId: number, quotaKey: string) {
    this.findByQuotaKey(workspaceId, quotaKey).then((quota) => {
      if (!quota) {
        throw new Error(
          `Usage not found for workspaceId ${workspaceId} and quotaKey ${quotaKey}`,
        );
      }

      return this.prisma.usage.delete({
        where: {
          workspaceId_quotaId: {
            workspaceId,
            quotaId: quota.quotaId,
          },
        },
      });
    });
  }

  listWorkspaceUsage(workspaceId: number) {
    return this.prisma.usage.findMany({
      where: {
        workspaceId,
      },
      include: {
        quota: true,
      },
    });
  }
}
