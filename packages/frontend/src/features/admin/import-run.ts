//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';

import { AUDIT_ACTIONS, logAudit } from '@/services/audit.service';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
  type EmployeeInput,
} from '@/services/employees.service';

import { planImport, type ImportPlan, type PlannedRow } from './import-plan';

export type RowOutcome =
  | { line: number; status: 'created'; record: EmployeeRecord }
  | { line: number; status: 'updated'; record: EmployeeRecord; previous: Partial<EmployeeInput> }
  | { line: number; status: 'unchanged' }
  | { line: number; status: 'failed'; error: string }
  | { line: number; status: 'not-attempted' };

export interface ImportResult {
  outcomes: RowOutcome[];
  /** Set when the run stopped early; rows after it were not attempted. */
  stoppedAt: number | null;
  /** Set when the data changed between preview and run, so nothing was written. */
  aborted: string | null;
}

const message = (e: unknown) =>
  e instanceof Error ? e.message.replace(/^GraphQL errors:\s*/i, '') : 'Unexpected error';

/**
 * Writes a validated plan one row at a time.
 *
 * The data API has no multi-row transaction, so the run is explicit instead:
 * 1. Re-validate against the current table; if anything changed since the
 *    preview, write nothing.
 * 2. Write rows in order. On the first failure, stop: later rows are not
 *    attempted, and the caller is offered `rollbackImport` for rows already written.
 */
export async function runImport(table: string[][], preview: ImportPlan): Promise<ImportResult> {
  const fresh = planImport(table, await listEmployees());
  const changed =
    fresh.fileErrors.length > 0 ||
    fresh.counts.error > 0 ||
    fresh.counts.create !== preview.counts.create ||
    fresh.counts.update !== preview.counts.update;
  if (changed) {
    const aborted =
      'The Employees table changed after the preview, so nothing was imported. Review the new preview and try again.';
    void logAudit({ action: AUDIT_ACTIONS.employeeImport, entityType: 'Employee', status: 'failure', details: 'Aborted before writing', error: aborted });
    return { outcomes: fresh.rows.map((r) => ({ line: r.line, status: 'not-attempted' })), stoppedAt: null, aborted };
  }

  const outcomes: RowOutcome[] = [];
  let stoppedAt: number | null = null;
  for (const row of fresh.rows) {
    if (stoppedAt !== null) {
      outcomes.push({ line: row.line, status: 'not-attempted' });
      continue;
    }
    const outcome = await writeRow(row);
    outcomes.push(outcome);
    if (outcome.status === 'failed') stoppedAt = row.line;
  }

  const count = (s: RowOutcome['status']) => outcomes.filter((o) => o.status === s).length;
  void logAudit({
    action: AUDIT_ACTIONS.employeeImport,
    entityType: 'Employee',
    status: stoppedAt === null ? 'success' : 'failure',
    details: `${outcomes.length} rows: ${count('created')} created, ${count('updated')} updated, ${count('unchanged')} unchanged, ${count('failed')} failed, ${count('not-attempted')} not attempted`,
    error: stoppedAt === null ? undefined : `Stopped at line ${stoppedAt}`,
  });
  return { outcomes, stoppedAt, aborted: null };
}

async function writeRow(row: PlannedRow): Promise<RowOutcome> {
  try {
    if (row.kind === 'create') {
      const record = await createEmployee(row.value, row.employeeId ?? undefined);
      void logAudit({ action: AUDIT_ACTIONS.employeeImportRow, entityType: 'Employee', recordId: record.id, status: 'success', details: `Line ${row.line}: created` });
      return { line: row.line, status: 'created', record };
    }
    if (row.kind === 'update') {
      const previous = Object.fromEntries(
        Object.keys(row.changes).map((k) => [k, row.target[k as keyof EmployeeInput]])
      ) as Partial<EmployeeInput>;
      const record = await updateEmployee(row.target.id, row.changes);
      void logAudit({ action: AUDIT_ACTIONS.employeeImportRow, entityType: 'Employee', recordId: record.id, status: 'success', details: `Line ${row.line}: updated ${Object.keys(row.changes).join(', ')}` });
      return { line: row.line, status: 'updated', record, previous };
    }
    return { line: row.line, status: 'unchanged' };
  } catch (e) {
    void logAudit({
      action: AUDIT_ACTIONS.employeeImportRow,
      entityType: 'Employee',
      recordId: row.kind === 'update' ? row.target.id : undefined,
      status: 'failure',
      details: `Line ${row.line}: ${row.kind}`,
      error: e,
    });
    return { line: row.line, status: 'failed', error: message(e) };
  }
}

/** Undoes the rows an import wrote: deletes created rows, restores updated fields. */
export async function rollbackImport(outcomes: readonly RowOutcome[]): Promise<{ undone: number; failed: string[] }> {
  let undone = 0;
  const failed: string[] = [];
  for (const o of [...outcomes].reverse()) {
    try {
      if (o.status === 'created') await deleteEmployee(o.record.id);
      else if (o.status === 'updated') await updateEmployee(o.record.id, o.previous);
      else continue;
      undone++;
    } catch (e) {
      failed.push(`Line ${o.line}: ${message(e)}`);
    }
  }
  void logAudit({
    action: AUDIT_ACTIONS.employeeImport,
    entityType: 'Employee',
    status: failed.length ? 'failure' : 'success',
    details: `Rollback: ${undone} row(s) undone`,
    error: failed.length ? failed.join('; ') : undefined,
  });
  return { undone, failed };
}
