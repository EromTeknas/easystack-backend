import { prisma } from '../db';
import { NotFoundError } from '../errors';

export interface ResolvedEnvironment {
  id: number;
  name: string;
  displayName: string;
  rank: number;
  isEditable: boolean;
  isBaseAuthoring: boolean; // true if rank is lowest in project or isEditable === true
}

export const EnvironmentResolverService = {
  /**
   * Resolves an environment for a project given an ID, a name/slug, or undefined (default base environment).
   */
  async resolve(projectId: number, envParam?: string | number | null): Promise<ResolvedEnvironment> {
    const allEnvs = await prisma.environment.findMany({
      where: { projectId },
      orderBy: { rank: 'asc' },
    });

    if (!allEnvs || allEnvs.length === 0 || !allEnvs[0]) {
      throw new NotFoundError(`No environments found for project ${projectId}`);
    }

    const firstEnv = allEnvs[0];
    const lowestRank = firstEnv.rank;

    let matched = firstEnv; // Default to lowest rank (base authoring)

    if (envParam !== undefined && envParam !== null && String(envParam).trim() !== '') {
      const cleanParam = String(envParam).trim().toLowerCase();
      const asNumber = Number(cleanParam);

      if (!isNaN(asNumber) && asNumber > 0) {
        const byId = allEnvs.find((e) => e.id === asNumber);
        if (byId) {
          matched = byId;
        } else {
          throw new NotFoundError(`Environment ID ${asNumber} not found in this project`);
        }
      } else {
        const byName = allEnvs.find((e) => e.name.toLowerCase() === cleanParam);
        if (byName) {
          matched = byName;
        } else {
          // Check common aliases (e.g. dev <-> development, live <-> production)
          const alias =
            cleanParam === 'development'
              ? 'dev'
              : cleanParam === 'dev'
              ? 'development'
              : cleanParam === 'production'
              ? 'live'
              : cleanParam === 'live'
              ? 'production'
              : null;
          const byAlias = alias ? allEnvs.find((e) => e.name.toLowerCase() === alias) : null;
          if (byAlias) {
            matched = byAlias;
          } else {
            throw new NotFoundError(`Environment '${cleanParam}' not found in this project`);
          }
        }
      }
    }

    const isBaseAuthoring = matched.isEditable || matched.rank === lowestRank;

    return {
      id: matched.id,
      name: matched.name,
      displayName: matched.displayName || matched.name,
      rank: matched.rank,
      isEditable: matched.isEditable,
      isBaseAuthoring,
    };
  },

  /**
   * Retrieves the base authoring environment (lowest rank / isEditable).
   */
  async getBaseEnvironment(projectId: number): Promise<ResolvedEnvironment> {
    return this.resolve(projectId, null);
  },

  /**
   * Retrieves all project environments ordered by rank asc.
   */
  async getAllEnvironments(projectId: number): Promise<ResolvedEnvironment[]> {
    const allEnvs = await prisma.environment.findMany({
      where: { projectId },
      orderBy: { rank: 'asc' },
    });
    const lowestRank = allEnvs[0]?.rank ?? 0;
    return allEnvs.map((e) => ({
      id: e.id,
      name: e.name,
      displayName: e.displayName || e.name,
      rank: e.rank,
      isEditable: e.isEditable,
      isBaseAuthoring: e.isEditable || e.rank === lowestRank,
    }));
  },
};
