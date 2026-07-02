import { UserStatus } from "@prisma/client";
/**
 * Generate fake users for testing purposes
 */
interface FakeUserConfig {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  status?: UserStatus;
  emailVerified?: boolean;
  workspace: Record<string, string>;
  subscription?: {
    plan: string;
    trial?: boolean;
  };

}

export const fakeUsers: FakeUserConfig[] = [
  {
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Johnson",
    password: "Test@12345678",
    status: "ACTIVE",
    emailVerified: true,
    workspace: {
      name: "Alice's Workspace",
      slug: "alice-workspace",
    },
    subscription: {
      plan: "pro",
      trial: true,
    }
  },
  {
    email: "bob@example.com",
    firstName: "Bob",
    lastName: "Smith",
    password: "Test@98765432",
    status: "ACTIVE",
    emailVerified: true,
    workspace: {
      name: "Bob's Workspace",
      slug: "bob-workspace",
    },
    subscription: {
      plan: "free",
    }
  },
  {
    email: "charlie@example.com",
    firstName: "Charlie",
    lastName: "Brown",
    password: "Test@11223344",
    status: "ACTIVE",
    emailVerified: true,
    workspace: {
      name: "Charlie's Workspace",
      slug: "charlie-workspace",
    },
    subscription: {
      plan: "enterprise",
    }
  },
];