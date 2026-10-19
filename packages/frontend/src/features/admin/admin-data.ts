//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { AppUserRecord, AuditEventRecord, RoleAssignment } from '@rayfin-app/shared';

import { getRayfinClient } from '@/lib/rayfin-client';

export const DAY = 24 * 60 * 60 * 1000;

/** People who have created or edited records (one Users row each). */
export async function listAppUsers(): Promise<AppUserRecord[]> {
  const client = await getRayfinClient();
  return (await client.data.AppUser.select(['id', 'Email', 'FirstSeenAt']).first(-1).execute()) as AppUserRecord[];
}

/** The most recent audit event time for each email. */
export function lastActivityByEmail(events: readonly AuditEventRecord[]): Map<string, Date> {
  const out = new Map<string, Date>();
  for (const e of events) {
    const key = e.UserEmail.toLowerCase();
    const at = new Date(e.OccurredAt);
    const prev = out.get(key);
    if (!prev || at > prev) out.set(key, at);
  }
  return out;
}

export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'employee.create': 'Employee created',
    'employee.update': 'Employee updated',
    'employee.delete': 'Employee deleted',
    'employee.import': 'CSV import',
    'employee.import.row': 'Import row',
    'employee.export': 'CSV export',
    'employee.bulk_delete': 'Bulk delete',
    'admin.role_change_drafted': 'Role change drafted',
    'admin.rule_check': 'Access rules checked',
    'system.health_check': 'Health check',
  };
  return labels[action] ?? action;
}

/** The assignments as TypeScript, ready to paste into access.ts. */
export function assignmentsSource(list: readonly RoleAssignment[]): string {
  const items = list
    .map(
      (a) =>
        `  {\n    email: ${JSON.stringify(a.email)},\n    name: ${JSON.stringify(a.name)},\n    role: ${JSON.stringify(a.role)},\n    status: ${JSON.stringify(a.status)},\n    addedAt: ${JSON.stringify(a.addedAt)},\n  },`
    )
    .join('\n');
  return `export const ROLE_ASSIGNMENTS: readonly RoleAssignment[] = [\n${items}\n];\n`;
}
