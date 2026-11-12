import { describe, test } from "node:test";
import assert from "node:assert";
import { UserService } from "../../src/services/user/user.service";

describe("User Profile Service", () => {
  test("getProfile throws NotFoundError if user does not exist", async () => {
    await assert.rejects(
      async () => {
        await UserService.getProfile(99999999);
      },
      {
        name: "NotFoundError",
        message: "User not found",
      }
    );
  });

  test("updateProfile throws NotFoundError if user does not exist", async () => {
    await assert.rejects(
      async () => {
        await UserService.updateProfile(99999999, { firstName: "Test" });
      },
      {
        name: "NotFoundError",
        message: "User not found",
      }
    );
  });
});
