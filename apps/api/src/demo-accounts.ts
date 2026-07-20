import type {
  AuthService
} from "@door010/identity-profile";

export const PUBLIC_DEMO_ACCOUNTS = {
  candidate: {
    email: "test21@doorai.nl",
    password: "admin010",
    roles: ["candidate"] as const
  },
  administrator: {
    email: "admin@doorai.nl",
    password: "admin010",
    roles: ["administrator"] as const
  }
} as const;

export async function provisionPublicDemoAccounts(
  auth: AuthService
): Promise<void> {
  await auth.provisionPublicDemoAccount(
    PUBLIC_DEMO_ACCOUNTS.candidate
  );
  await auth.provisionPublicDemoAccount(
    PUBLIC_DEMO_ACCOUNTS.administrator
  );
}
