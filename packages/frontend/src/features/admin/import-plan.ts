//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';

import {
  FIELD_LABELS,
  validateField,
  type EditableField,
  type EmployeeInput,
} from '@/services/employees.service';

export const REQUIRED_COLUMNS: readonly EditableField[] = [
  'FullName',
  'Email',
  'Department',
  'JobTitle',
  'Salary',
  'JoiningDate',
];
export const OPTIONAL_COLUMNS = ['EmployeeID'] as const;
export const MAX_IMPORT_ROWS = 1000;

export type PlannedRow =
  | { line: number; kind: 'create'; employeeId: number | null; value: EmployeeInput; issues: [] }
  | {
      line: number;
      kind: 'update';
      employeeId: number;
      target: EmployeeRecord;
      /** Only the fields whose values differ from the stored record. */
      changes: Partial<EmployeeInput>;
      issues: [];
    }
  | { line: number; kind: 'unchanged'; employeeId: number; target: EmployeeRecord; issues: [] }
  | { line: number; kind: 'error'; employeeId: number | null; name: string; issues: string[] };

export interface ImportPlan {
  /** Problems with the file as a whole; when present no row is importable. */
  fileErrors: string[];
  warnings: string[];
  rows: PlannedRow[];
  counts: { create: number; update: number; unchanged: number; error: number };
}

/**
 * Checks every row of a parsed CSV against the field rules and the current
 * table. Nothing is written here; the plan is only importable when it has no
 * errors at all.
 */
export function planImport(table: string[][], existing: readonly EmployeeRecord[]): ImportPlan {
  const fileErrors: string[] = [];
  const warnings: string[] = [];
  const counts = { create: 0, update: 0, unchanged: 0, error: 0 };
  const empty = (): ImportPlan => ({ fileErrors, warnings, rows: [], counts });

  if (table.length === 0) {
    fileErrors.push('The file is empty.');
    return empty();
  }
  const header = table[0]!.map((h) => h.trim());
  const index = new Map(header.map((h, i) => [h.toLowerCase(), i]));
  const missing = REQUIRED_COLUMNS.filter((c) => !index.has(c.toLowerCase()));
  if (missing.length) fileErrors.push(`Missing required column(s): ${missing.join(', ')}.`);
  const dupes = header.filter((h, i) => header.findIndex((x) => x.toLowerCase() === h.toLowerCase()) !== i);
  if (dupes.length) fileErrors.push(`Duplicate column(s): ${[...new Set(dupes)].join(', ')}.`);
  const known = new Set([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((c) => c.toLowerCase()));
  const extra = header.filter((h) => h && !known.has(h.toLowerCase()));
  if (extra.length) warnings.push(`Ignored column(s): ${extra.join(', ')}.`);
  const body = table.slice(1);
  if (body.length === 0) fileErrors.push('The file has a header row but no employees.');
  if (body.length > MAX_IMPORT_ROWS)
    fileErrors.push(`The file has ${body.length} rows; import at most ${MAX_IMPORT_ROWS} at a time.`);
  if (fileErrors.length) return empty();

  const cell = (row: string[], column: string) => {
    const raw = (row[index.get(column.toLowerCase()) ?? -1] ?? '').trim();
    // Undo the apostrophe that export adds to formula-like cells.
    return /^'[=+\-@]/.test(raw) ? raw.slice(1) : raw;
  };
  const byId = new Map(existing.map((e) => [e.EmployeeID, e]));
  const byEmail = new Map(existing.map((e) => [e.Email.toLowerCase(), e]));

  // First pass: per-row validation.
  const drafts = body.map((row, i) => {
    const line = i + 2;
    const issues: string[] = [];
    const value: Partial<EmployeeInput> = {};
    for (const column of REQUIRED_COLUMNS) {
      const result = validateField(column, cell(row, column));
      if (result.error !== undefined) issues.push(`${FIELD_LABELS[column]}: ${result.error}`);
      else (value as Record<string, unknown>)[column] = result.value;
    }
    const idText = index.has('employeeid') ? cell(row, 'EmployeeID').replace(/^emp-?/i, '') : '';
    let employeeId: number | null = null;
    if (idText) {
      if (/^\d+$/.test(idText) && Number(idText) >= 1 && Number(idText) <= 2_147_483_647) employeeId = Number(idText);
      else issues.push('Employee ID: must be a whole number of 1 or more, or left blank for a new employee.');
    }
    return { line, row, issues, value, employeeId, name: cell(row, 'FullName') };
  });

  // Second pass: duplicates within the file.
  const seenIds = new Map<number, number>();
  const seenEmails = new Map<string, number>();
  for (const d of drafts) {
    if (d.employeeId !== null) {
      const other = seenIds.get(d.employeeId);
      if (other) d.issues.push(`Employee ID ${d.employeeId} also appears on line ${other}.`);
      else seenIds.set(d.employeeId, d.line);
    }
    const email = d.value.Email?.toLowerCase();
    if (email) {
      const other = seenEmails.get(email);
      if (other) d.issues.push(`Email also appears on line ${other}.`);
      else seenEmails.set(email, d.line);
    }
  }

  // Third pass: against the stored table.
  const rows: PlannedRow[] = drafts.map((d) => {
    const target = d.employeeId !== null ? byId.get(d.employeeId) : undefined;
    const email = d.value.Email?.toLowerCase();
    const owner = email ? byEmail.get(email) : undefined;
    if (owner && owner.id !== target?.id) {
      d.issues.push(`Email is already used by ${owner.FullName} (EMP-${String(owner.EmployeeID).padStart(4, '0')}).`);
    }
    if (d.issues.length) {
      counts.error++;
      return { line: d.line, kind: 'error', employeeId: d.employeeId, name: d.name, issues: d.issues };
    }
    const value = d.value as EmployeeInput;
    if (!target) {
      counts.create++;
      return { line: d.line, kind: 'create', employeeId: d.employeeId, value, issues: [] };
    }
    const changes = diff(target, value);
    if (Object.keys(changes).length === 0) {
      counts.unchanged++;
      return { line: d.line, kind: 'unchanged', employeeId: target.EmployeeID, target, issues: [] };
    }
    counts.update++;
    return { line: d.line, kind: 'update', employeeId: target.EmployeeID, target, changes, issues: [] };
  });

  return { fileErrors, warnings, rows, counts };
}

function diff(current: EmployeeRecord, next: EmployeeInput): Partial<EmployeeInput> {
  const out: Partial<EmployeeInput> = {};
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (current.FullName !== next.FullName) out.FullName = next.FullName;
  if (!same(current.Email, next.Email)) out.Email = next.Email;
  if (!same(current.Department, next.Department)) out.Department = next.Department;
  if (!same(current.JobTitle, next.JobTitle)) out.JobTitle = next.JobTitle;
  if (Number(current.Salary) !== next.Salary) out.Salary = next.Salary;
  if (new Date(current.JoiningDate).getTime() !== next.JoiningDate.getTime()) out.JoiningDate = next.JoiningDate;
  return out;
}

/** The header and an example row, so people can start from a valid file. */
export const IMPORT_TEMPLATE = [
  ['EmployeeID', ...REQUIRED_COLUMNS],
  ['', 'Jane Doe', 'jane.doe@company.com', 'Finance', 'Financial Analyst', '1250000.00', '2026-01-15'],
];
