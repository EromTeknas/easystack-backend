import UserRepository from "../../repositories/user.repository";

export class UserService {
  static async searchUsers(query: string, take: number = 10) {
    return UserRepository.searchUsers(query, take);
  }
}
