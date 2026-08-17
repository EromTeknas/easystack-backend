import { prisma } from "../db";
import { generateUniqueIdentifier } from "../utils/identifier";

export default class WorkspaceRepository {
    private static WORKSPACE_IDENTIFIER_PREFIX : string = "WSP";
    private static WORKSPACE_IDENTIFIER_LENGTH : number = 12;

    static getWorkspaceIdentifier() {
        return generateUniqueIdentifier(this.WORKSPACE_IDENTIFIER_PREFIX, this.WORKSPACE_IDENTIFIER_LENGTH);
    }
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
}