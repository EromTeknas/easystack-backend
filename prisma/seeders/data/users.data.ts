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
  workspaceName?: string;
}

export const fakeUsers: FakeUserConfig[] = [
  {
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Johnson",
    password: "Test@12345678",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "Alice's Workspace",
  },
  {
    email: "bob@example.com",
    firstName: "Bob",
    lastName: "Smith",
    password: "Test@98765432",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "Bob's Workspace",
  },
  {
    email: "charlie@example.com",
    firstName: "Charlie",
    lastName: "Brown",
    password: "Test@11223344",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "Charlie's Workspace",
  },
  {
    email: "diana@example.com",
    firstName: "Diana",
    lastName: "Prince",
    password: "Test@55667788",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "Diana's Workspace",
  },
  {
    email: "evan@example.com",
    firstName: "Evan",
    lastName: "Davis",
    password: "Test@99887766",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "Evan's Workspace",
  },
  {
    email: "fiona@example.com",
    firstName: "Fiona",
    lastName: "Wilson",
    password: "Test@44332211",
    status: "PENDING_VERIFICATION",
    emailVerified: false,
    workspaceName: "Fiona's Workspace",
  },
  {
    email: "george@example.com",
    firstName: "George",
    lastName: "Miller",
    password: "Test@77554433",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "George's Workspace",
  },
  {
    email: "helen@example.com",
    firstName: "Helen",
    lastName: "Taylor",
    password: "Test@88664422",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "Helen's Workspace",
  },
  {
    email: "ian@example.com",
    firstName: "Ian",
    lastName: "Anderson",
    password: "Test@22334455",
    status: "INACTIVE",
    emailVerified: true,
    workspaceName: "Ian's Workspace",
  },
  {
    email: "julia@example.com",
    firstName: "Julia",
    lastName: "Thomas",
    password: "Test@66778899",
    status: "ACTIVE",
    emailVerified: true,
    workspaceName: "Julia's Workspace",
  },
];