import { prisma } from "../db";
import { NotFoundError } from "../errors";
import { AppRoleKey } from "../services/authorization/constants/role.constants";


export class RoleRepository {
  /**
   * Find a role by its unique key.
   */
  static async findByKey(key: AppRoleKey) {
    return await prisma.role.findUnique({
      where: {
        key,
      },
    });
  }
}