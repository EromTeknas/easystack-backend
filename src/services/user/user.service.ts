import UserRepository from "../../repositories/user.repository";
import { NotFoundError } from "../../errors";

export class UserService {
  static async searchUsers(query: string, take: number = 10) {
    return UserRepository.searchUsers(query, take);
  }

  static async getProfile(userId: number) {
    const user = await UserRepository.getProfile(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  static async updateProfile(
    userId: number,
    data: { firstName?: string | undefined; lastName?: string | undefined; avatarUrl?: string | null | undefined }
  ) {
    const existing = await UserRepository.findById(userId);
    if (!existing) {
      throw new NotFoundError("User not found");
    }
    return UserRepository.updateProfile(userId, data);
  }
}
