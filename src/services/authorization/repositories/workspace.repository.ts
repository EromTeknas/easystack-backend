// import { PrismaClient } from "@prisma/client";

// import {
//   AuthorizationAssignment,
//   AuthorizationRepository,
// } from "./authorization.repository";

// export class PrismaAuthorizationRepository
//   implements AuthorizationRepository
// {
//   constructor(
//     private readonly prisma: PrismaClient,
//   ) {}

//   async getAssignments(
//     userId: number,
//   ): Promise<AuthorizationAssignment[]> {
//     const assignments: AuthorizationAssignment[] = [];

//     const workspaceMembers =
//       await this.prisma.workspaceMember.findMany({
//         where: {
//           userId,
//           removedAt: null,
//         },
//       });

//     for (const member of workspaceMembers) {
//       assignments.push({
//         scope: "workspace",

//         scopeId: member.workspaceId.toString(),

//         roles: [member.role],

//         customPermissions: [],

//         deniedPermissions: [],
//       });
//     }

//     const projectMembers =
//       await this.prisma.projectMember.findMany({
//         where: {
//           userId,
//           removedAt: null,
//         },
//       });

//     for (const member of projectMembers) {
//       assignments.push({
//         scope: "project",

//         scopeId: member.projectId.toString(),

//         roles: [member.role],

//         customPermissions: [],

//         deniedPermissions: [],
//       });
//     }

//     return assignments;
//   }
// }