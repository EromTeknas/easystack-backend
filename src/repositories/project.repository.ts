import type { Prisma, PrismaClient, Role, WorkspaceMember } from '@prisma/client';
import { prisma } from '../db';

type DbClient = PrismaClient | Prisma.TransactionClient;

type WorkspaceMemberWithRoleAndProjectMemberships = WorkspaceMember & {
  role: Role;
  projectMemberships: { id: number }[];
};

class ProjectRepository {
  static async findProjectById(db: DbClient, projectId: number) {
    return db.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: true,
      },
    });
  }

  static async findProjectBySlug(db: DbClient, slug: string) {
    return db.project.findUnique({
      where: { slug },
      include: {
        workspace: true,
      },
    });
  }

  static async findWorkspaceMemberWithRole(
    db: DbClient,
    workspaceId: number,
    userId: number
  ) {
    return db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        removedAt: null,
      },
      include: {
        role: true,
      },
    });
  }

  static async findWorkspaceMemberWithRoleAndProjectMembership(
    db: DbClient,
    workspaceId: number,
    userId: number,
    projectId: number
  ): Promise<WorkspaceMemberWithRoleAndProjectMemberships | null> {
    return db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        removedAt: null,
      },
      include: {
        role: true,
        projectMemberships: {
          where: {
            projectId,
            removedAt: null,
          },
          select: {
            id: true,
          },
        },
      },
    });
  }

  static async listWorkspaceProjects(db: DbClient, workspaceId: number) {
    return db.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async listProjectsByWorkspaceMember(
    db: DbClient,
    workspaceMemberId: number,
    workspaceId: number
  ) {
    return db.projectMember.findMany({
      where: {
        workspaceMemberId,
        removedAt: null,
        project: {
          workspaceId,
        },
      },
      include: {
        project: true,
      },
      orderBy: {
        project: {
          createdAt: 'desc',
        },
      },
    });
  }

  static async findRoleByKey(db: DbClient, roleKey: string) {
    return db.role.findUnique({
      where: {
        key: roleKey,
      },
    });
  }

  static async createProject(
    db: DbClient,
    data: {
      resourceId: string;
      workspaceId: number;
      createdById: number;
      name: string;
      slug: string;
      description: string | null;
      supportedLanguages: any;
    }
  ) {
    return db.project.create({
      data,
    });
  }

  static async createProjectMember(
    db: DbClient,
    data: { projectId: number; workspaceMemberId: number; roleId: number }
  ) {
    return db.projectMember.create({
      data,
    });
  }

  static async updateProject(
    db: DbClient,
    projectId: number,
    data: { name?: string; slug?: string; description?: string | null }
  ) {
    return db.project.update({
      where: { id: projectId },
      data,
    });
  }

  static async deleteProject(db: DbClient, projectId: number) {
    return db.project.delete({
      where: { id: projectId },
    });
  }
}

export { ProjectRepository };
