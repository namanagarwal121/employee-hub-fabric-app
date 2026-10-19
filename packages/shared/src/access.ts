/**
 * Who may use Employee Hub, and with which role.
 *
 * THIS LIST IS ENFORCED BY THE SERVER. The data permissions in
 * `@rayfin-app/data` are generated from it, so a change here only takes effect
 * after the app is redeployed (`npx rayfin up`). Anyone who is not listed, or
 * whose status is `inactive`, is denied every data operation.
 *
 * Emails must match the address Microsoft sign-in reports for the person.
 */

export type AppRole = 'Admin' | 'HR Manager' | 'Viewer';
export type AccountStatus = 'active' | 'inactive';

export interface RoleAssignment {
  readonly email: string;
  readonly name: string;
  readonly role: AppRole;
  readonly status: AccountStatus;
  /** ISO date the person was added to this list. */
  readonly addedAt: string;
}

export const ROLE_ASSIGNMENTS: readonly RoleAssignment[] = [
  {
    email: 'naman@namanag1211outlook.onmicrosoft.com',
    name: 'Naman',
    role: 'Admin',
    status: 'active',
    addedAt: '2026-10-19',
  },
];

export const ROLES: readonly AppRole[] = ['Admin', 'HR Manager', 'Viewer'];

/** What each role may do. The server rules and the UI both read this. */
export const ROLE_CAPABILITIES: Record<
  AppRole,
  { readEmployees: boolean; writeEmployees: boolean; importExport: boolean; admin: boolean }
> = {
  Admin: { readEmployees: true, writeEmployees: true, importExport: true, admin: true },
  'HR Manager': { readEmployees: true, writeEmployees: true, importExport: true, admin: false },
  Viewer: { readEmployees: true, writeEmployees: false, importExport: false, admin: false },
};

export type Capability = keyof (typeof ROLE_CAPABILITIES)[AppRole];

/** Active emails holding a capability, for building server rules. */
export function emailsWith(
  capability: Capability,
  assignments: readonly RoleAssignment[] = ROLE_ASSIGNMENTS
): string[] {
  return assignments
    .filter((a) => a.status === 'active' && ROLE_CAPABILITIES[a.role][capability])
    .map((a) => a.email);
}

/** The active assignment for an email, ignoring case; null denies access. */
export function assignmentFor(
  email: string | null | undefined,
  assignments: readonly RoleAssignment[] = ROLE_ASSIGNMENTS
): RoleAssignment | null {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  return assignments.find((a) => a.email.toLowerCase() === key) ?? null;
}
