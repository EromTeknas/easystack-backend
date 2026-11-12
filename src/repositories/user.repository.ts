import { prisma } from "../db";
import { User } from "@prisma/client";

class UserRepository {
  async searchUsers(query: string, take: number = 10) {
    return prisma.user.findMany({
      where: {
        email: query, // Exact email match only for privacy
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

  async getProfile(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        resourceId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        onboardingCompleted: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(
    userId: number,
    data: { firstName?: string | undefined; lastName?: string | undefined; avatarUrl?: string | null | undefined }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
      select: {
        id: true,
        resourceId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        onboardingCompleted: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}

export default new UserRepository();
