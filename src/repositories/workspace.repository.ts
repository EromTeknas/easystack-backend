import { prisma } from "../db";

export default class WorkspaceRepository {
    static async getUserWorkspaces(userId: number) {
        return prisma.workspace.findMany({
            where: { members: { some: { userId } } },
        });
    }

    static async getUserWorkspaceById(userId: number, workspaceId: number) {
        return prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                members: { some: { userId } },
            },
        });
    }
}