import crypto from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * Resource Type Identifiers
 * Format: PREFIX + 9 digits (e.g., USR111111111)
 */
enum ResourceType {
  USER = 'USR',
  WORKSPACE = 'WSP',
  PROJECT = 'PRJ',
}

/**
 * Generates unique 12-character resource identifiers
 * Format: [PREFIX][9-digit-number]
 * Examples: USR123456789, WSP987654321, PRJ555555555
 */
class ResourceIdService {
  private static readonly MAX_GENERATION_ATTEMPTS = 20;

  /**
   * Generates a unique resource identifier
   * @param type - The resource type (USER, WORKSPACE, PROJECT)
   * @returns A unique 12-character identifier
   */
  static generateResourceId(type: ResourceType): string {
    const prefix = type;
    // Generate 9 random digits
    const randomNum = crypto.randomInt(100000000, 999999999);
    return `${prefix}${randomNum}`;
  }

  /**
   * Generates a resource ID for a User
   */
  static generateUserId(): string {
    return this.generateResourceId(ResourceType.USER);
  }

  /**
   * Generates a resource ID for a Workspace
   */
  static generateWorkspaceId(): string {
    return this.generateResourceId(ResourceType.WORKSPACE);
  }

  /**
   * Generates a resource ID for a Project
   */
  static generateProjectId(): string {
    return this.generateResourceId(ResourceType.PROJECT);
  }

  /**
   * Generates a unique user resource ID by checking database collisions.
   */
  static async generateUniqueUserId(
    db: PrismaClient | Prisma.TransactionClient
  ): Promise<string> {
    return this.generateUniqueId(
      () => this.generateUserId(),
      async (candidate) => {
        const existing = await db.user.findUnique({
          where: { resourceId: candidate },
          select: { id: true }
        });
        return !!existing;
      }
    );
  }

  /**
   * Generates a unique workspace resource ID by checking database collisions.
   */
  static async generateUniqueWorkspaceId(
    db: PrismaClient | Prisma.TransactionClient
  ): Promise<string> {
    return this.generateUniqueId(
      () => this.generateWorkspaceId(),
      async (candidate) => {
        const existing = await db.workspace.findUnique({
          where: { resourceId: candidate },
          select: { id: true }
        });
        return !!existing;
      }
    );
  }

  /**
   * Generates a unique project resource ID by checking database collisions.
   */
  static async generateUniqueProjectId(
    db: PrismaClient | Prisma.TransactionClient
  ): Promise<string> {
    return this.generateUniqueId(
      () => this.generateProjectId(),
      async (candidate) => {
        const existing = await db.project.findUnique({
          where: { resourceId: candidate },
          select: { id: true }
        });
        return !!existing;
      }
    );
  }

  /**
   * Validates a resource identifier format
   * @param resourceId - The resource ID to validate
   * @param expectedType - Optional expected type to validate against
   */
  static isValidResourceId(
    resourceId: string,
    expectedType?: ResourceType
  ): boolean {
    const pattern = /^(USR|WSP|PRJ)\d{9}$/;

    if (!pattern.test(resourceId)) {
      return false;
    }

    if (expectedType) {
      return resourceId.startsWith(expectedType);
    }

    return true;
  }

  /**
   * Extracts the type from a resource identifier
   */
  static getResourceType(
    resourceId: string
  ): ResourceType | null {
    const prefix = resourceId.substring(0, 3);
    if (Object.values(ResourceType).includes(prefix as ResourceType)) {
      return prefix as ResourceType;
    }
    return null;
  }

  private static async generateUniqueId(
    generator: () => string,
    exists: (candidate: string) => Promise<boolean>
  ): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const candidate = generator();
      const collision = await exists(candidate);
      if (!collision) {
        return candidate;
      }
    }

    throw new Error('Unable to generate a unique resource ID after multiple attempts');
  }
}

export default ResourceIdService;
export { ResourceType };
