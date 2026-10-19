//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { AuditEventRecord } from '@rayfin-app/shared';

import { getRayfinClient } from '@/lib/rayfin-client';

/** Actions the app records. Stored as text so the log can grow. */
export const AUDIT_ACTIONS = {
  employeeCreate: 'employee.create',
  employeeUpdate: 'employee.update',
  employeeDelete: 'employee.delete',
  employeeImport: 'employee.import',
  employeeImportRow: 'employee.import.row',
  employeeExport: 'employee.export',
  employeeBulkDelete: 'employee.bulk_delete',
  roleChangeDrafted: 'admin.role_change_drafted',
  healthCheck: 'system.health_check',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export interface AuditInput {
  action: AuditAction;
  entityType: string;
  recordId?: string | null;
  status: 'success' | 'failure';
  /** What happened, naming fields rather than their values. */
  details?: string;
  error?: unknown;
}

const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g;

/**
 * Removes anything that should not live in a log: email addresses inside
 * error text, provider prefixes, and overly long messages.
 */
export function sanitizeError(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/^GraphQL errors:\s*/i, '')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(EMAIL, '[email]')
    .slice(0, 1000);
}

/**
 * Appends one event to the AuditEvents table under the signed-in user's own
 * email. Never throws: a logging failure must not undo the user's action, so
 * it returns false and the caller carries on.
 */
export async function logAudit(input: AuditInput): Promise<boolean> {
  try {
    const client = await getRayfinClient();
    const email = client.auth.getSession().user?.email;
    if (!email) return false;
    await client.data.AuditEvent.create({
      OccurredAt: new Date(),
      UserEmail: email,
      Action: input.action,
      EntityType: input.entityType,
      RecordId: input.recordId ?? undefined,
      Status: input.status,
      Details: input.details?.slice(0, 2000),
      ErrorDetails: sanitizeError(input.error),
    });
    return true;
  } catch {
    return false;
  }
}

export interface AuditFilters {
  from?: Date | null;
  to?: Date | null;
  userEmail?: string | null;
  action?: string | null;
  status?: 'success' | 'failure' | null;
}

const AUDIT_FIELDS = [
  'id',
  'OccurredAt',
  'UserEmail',
  'Action',
  'EntityType',
  'RecordId',
  'Status',
  'Details',
  'ErrorDetails',
] as const;

/** One page of the log, newest first, filtered on the server. */
export async function listAuditEvents(
  filters: AuditFilters,
  pageSize: number,
  after?: string | null
): Promise<{ items: AuditEventRecord[]; endCursor: string | null; hasNextPage: boolean }> {
  const client = await getRayfinClient();
  const where: Record<string, unknown> = {};
  const occurred: Record<string, Date> = {};
  if (filters.from) occurred.gte = filters.from;
  if (filters.to) occurred.lte = filters.to;
  if (Object.keys(occurred).length) where.OccurredAt = occurred;
  if (filters.userEmail) where.UserEmail = { eq: filters.userEmail };
  if (filters.action) where.Action = { eq: filters.action };
  if (filters.status) where.Status = { eq: filters.status };

  let query = client.data.AuditEvent.select([...AUDIT_FIELDS])
    .orderBy({ OccurredAt: 'desc' })
    .first(pageSize);
  if (Object.keys(where).length) query = query.where(where as never);
  if (after) query = query.after(after);
  const page = await query.executePaginated();
  return {
    items: page.items as AuditEventRecord[],
    endCursor: page.endCursor ?? null,
    hasNextPage: page.hasNextPage,
  };
}

/** Every event since `since`, newest first, for metrics. Bounded to 5,000. */
export async function auditEventsSince(since: Date): Promise<AuditEventRecord[]> {
  const out: AuditEventRecord[] = [];
  let cursor: string | null = null;
  do {
    const page = await listAuditEvents({ from: since }, 500, cursor);
    out.push(...page.items);
    cursor = page.hasNextPage ? page.endCursor : null;
  } while (cursor && out.length < 5000);
  return out;
}
