import { prisma } from "../db";
import { User } from "@prisma/client";

class UserRepository {
  async searchUsers(query: string, take: number = 10) {
    return prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query } },
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { resourceId: { contains: query } },
        ]
      },
      select: {
        id: true,
        resourceId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      take,
    });
  }

  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }
}

export default new UserRepository();
