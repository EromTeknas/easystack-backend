import { prisma } from "../db";
import { generateUniqueIdentifier } from "../utils/identifier";

export default class WorkspaceRepository {
    private static WORKSPACE_IDENTIFIER_PREFIX : string = "WSP";
    private static WORKSPACE_IDENTIFIER_LENGTH : number = 12;

    static getWorkspaceIdentifier() {
        return generateUniqueIdentifier(this.WORKSPACE_IDENTIFIER_PREFIX, this.WORKSPACE_IDENTIFIER_LENGTH);
    }
    static async getUserWorkspaces(userId: number) {
        const members = await prisma.workspaceMember.findMany({
            where: { userId },
            include: {
                workspace: {
                    include: {
                        subscription: {
                            include: {
                                planVersion: {
                                    include: { plan: true }
                                }
                            }
                        }
                    }
                },
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                },
            }
        });
        
        return members.map(m => ({
            ...m.workspace,
            role: m.role.key,
            roleName: m.role.name,
            permissions: m.role.permissions.map(rp => `${rp.permission.resource}:${rp.permission.action}`),
        }));
    }

    static async getUserWorkspaceById(userId: number, workspaceId: number) {
        return prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                members: { some: { userId } },
            },
        });
    }

    static async updateWorkspace(workspaceId: number, data: any) {
        return prisma.workspace.update({
            where: { id: workspaceId },
            data,
        });
    }

    static async deleteWorkspace(workspaceId: number) {
        return prisma.workspace.delete({
            where: { id: workspaceId },
        });
    }

    static async getWorkspaceMembers(workspaceId: number) {
        return prisma.workspaceMember.findMany({
            where: { workspaceId, removedAt: null },
            include: {
                user: {
                    select: {
                        id: true,
                        resourceId: true,
                        email: true,
                        firstName: true,
                        lastName: true
                    }
                },
                role: {
                    select: {
                        id: true,
                        key: true,
                        name: true
                    }
                }
            },
            orderBy: { joinedAt: "asc" }
        });
    }
}