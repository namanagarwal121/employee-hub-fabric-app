//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  EMPLOYEE_LIMITS,
  type EmployeeRecord,
  type EmployeeRow,
} from '@rayfin-app/shared';

import { getRayfinClient } from '@/lib/rayfin-client';

/**
 * Every column the screens show. Department and job title are read through
 * their links. The two audit links both point at Users, which the nested read
 * does not resolve, so their emails are looked up from the Users table.
 */
const EMPLOYEE_SELECT = [
  'id',
  'EmployeeID',
  'FullName',
  'Email',
  'Salary',
  'JoiningDate',
  'CreatedAt',
  'UpdatedAt',
  'dept_id',
  'dept.Name',
  'title_id',
  'title.Title',
  'createdBy_id',
  'updatedBy_id',
] as const;

const PAGE_SIZE = 500;
const MAX_ID_ATTEMPTS = 3;

/** The editable fields; `EmployeeID` and `CreatedAt` are assigned on create. */
export type EmployeeInput = Pick<
  EmployeeRecord,
  'FullName' | 'Email' | 'Department' | 'JobTitle' | 'Salary' | 'JoiningDate'
>;

export class EmployeeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmployeeConflictError';
  }
}

/** Flattens a linked Employees row into the shape the screens use. */
export function toEmployeeRecord(
  row: EmployeeRow,
  userEmails: ReadonlyMap<string, string> = new Map()
): EmployeeRecord {
  const email = (id?: string | null) => (id ? (userEmails.get(id) ?? null) : null);
  return {
    id: row.id,
    EmployeeID: row.EmployeeID,
    FullName: row.FullName,
    Email: row.Email,
    Department: row.dept?.Name ?? '',
    JobTitle: row.title?.Title ?? '',
    Salary: Number(row.Salary),
    JoiningDate: row.JoiningDate,
    CreatedAt: row.CreatedAt,
    CreatedBy: row.createdBy?.Email ?? email(row.createdBy_id),
    UpdatedBy: row.updatedBy?.Email ?? email(row.updatedBy_id),
    UpdatedAt: row.UpdatedAt ?? null,
  };
}

/** Every Users row by id. The table holds one row per person who has edited. */
async function userEmails(): Promise<Map<string, string>> {
  const client = await getRayfinClient();
  const users = await client.data.AppUser.select(['id', 'Email']).first(-1).execute();
  return new Map(users.map((u) => [u.id, u.Email]));
}

/** Reads the whole table, paging until the backend reports no more rows. */
export async function listEmployees(): Promise<EmployeeRecord[]> {
  const client = await getRayfinClient();
  const users = await userEmails();
  const rows: EmployeeRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = client.data.Employee.select([...EMPLOYEE_SELECT])
      .orderBy({ EmployeeID: 'asc' })
      .first(PAGE_SIZE);
    if (cursor) query = query.after(cursor);
    const page = await query.executePaginated();
    rows.push(...(page.items as EmployeeRow[]).map((r) => toEmployeeRecord(r, users)));
    if (!page.hasNextPage || !page.endCursor) return rows;
    cursor = page.endCursor;
  }
}

async function readEmployee(id: string): Promise<EmployeeRecord> {
  const client = await getRayfinClient();
  const [row] = await client.data.Employee.select([...EMPLOYEE_SELECT])
    .where({ id: { eq: id } })
    .execute();
  if (!row) throw new Error('The saved employee could not be read back.');
  return toEmployeeRecord(row as EmployeeRow, await userEmails());
}

/**
 * Inserts an employee with the next sequential `EmployeeID`, the current time
 * as `CreatedAt`, and the signed-in user as `createdBy`. The ID column is
 * unique, so if another insert claims the same number first the save is
 * retried with a fresh one.
 */
export async function createEmployee(
  input: EmployeeInput,
  /** Use this EmployeeID instead of the next free one; a clash is an error. */
  requestedId?: number
): Promise<EmployeeRecord> {
  const client = await getRayfinClient();
  const [dept, title, user] = await Promise.all([
    departmentId(input.Department),
    jobTitleId(input.JobTitle),
    currentUserId(),
  ]);
  for (let attempt = 1; ; attempt++) {
    const EmployeeID = requestedId ?? (await highestEmployeeId()) + 1;
    try {
      const created = await client.data.Employee.create({
        EmployeeID,
        FullName: input.FullName,
        Email: input.Email,
        Salary: input.Salary,
        JoiningDate: input.JoiningDate,
        CreatedAt: new Date(),
        dept_id: dept,
        title_id: title,
        createdBy_id: user,
      });
      return await readEmployee(created.id);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (await emailInUse(input.Email)) throw duplicateEmail(input.Email);
      if (requestedId !== undefined) {
        throw new EmployeeConflictError(`Employee ID ${requestedId} is already in use.`);
      }
      if (attempt >= MAX_ID_ATTEMPTS) {
        throw new EmployeeConflictError(
          'Could not assign an employee ID because other records were being added at the same time. Try saving again.'
        );
      }
    }
  }
}

/**
 * Updates only the fields in `patch`, targeting the row by its primary key,
 * and records who made the change and when. Unrelated columns are never sent.
 */
export async function updateEmployee(
  id: string,
  patch: Partial<EmployeeInput>
): Promise<EmployeeRecord> {
  const client = await getRayfinClient();
  const { Department, JobTitle, ...scalars } = patch;
  const changes: Record<string, unknown> = { ...scalars };
  if (Department !== undefined) changes.dept_id = await departmentId(Department);
  if (JobTitle !== undefined) changes.title_id = await jobTitleId(JobTitle);
  changes.UpdatedAt = new Date();
  changes.updatedBy_id = await currentUserId();
  try {
    await client.data.Employee.update(
      { id },
      changes as Parameters<typeof client.data.Employee.update>[1]
    );
  } catch (error) {
    if (
      isUniqueViolation(error) &&
      patch.Email !== undefined &&
      (await emailInUse(patch.Email, id))
    ) {
      throw duplicateEmail(patch.Email);
    }
    throw error;
  }
  return readEmployee(id);
}

export async function deleteEmployee(id: string): Promise<void> {
  const client = await getRayfinClient();
  await client.data.Employee.delete({ id });
}

/** Finds the department by name (ignoring case), creating it the first time it is used. */
async function departmentId(name: string): Promise<string> {
  const client = await getRayfinClient();
  return findOrCreate(
    async () =>
      (await client.data.Department.select(['id', 'Name']).first(1000).execute()).find(
        (d) => d.Name.trim().toLowerCase() === name.trim().toLowerCase()
      )?.id,
    async () => (await client.data.Department.create({ Name: name.trim() })).id
  );
}

/** Finds the job title by text (ignoring case), creating it the first time it is used. */
async function jobTitleId(title: string): Promise<string> {
  const client = await getRayfinClient();
  return findOrCreate(
    async () =>
      (await client.data.JobTitle.select(['id', 'Title']).first(1000).execute()).find(
        (t) => t.Title.trim().toLowerCase() === title.trim().toLowerCase()
      )?.id,
    async () => (await client.data.JobTitle.create({ Title: title.trim() })).id
  );
}

/**
 * The Users row for whoever is signed in. The email comes from the session,
 * and the server only accepts a new row whose email matches the caller's own.
 */
async function currentUserId(): Promise<string> {
  const client = await getRayfinClient();
  const email = client.auth.getSession().user?.email;
  if (!email) throw new Error('Your sign-in did not include an email address, so the change cannot be attributed.');
  return findOrCreate(
    async () =>
      (await client.data.AppUser.select(['id']).where({ Email: { eq: email } }).execute())[0]?.id,
    async () => (await client.data.AppUser.create({ Email: email, FirstSeenAt: new Date() })).id
  );
}

/** Look up, else create; if a concurrent create won the unique race, look up again. */
async function findOrCreate(
  find: () => Promise<string | undefined>,
  create: () => Promise<string>
): Promise<string> {
  const existing = await find();
  if (existing) return existing;
  try {
    return await create();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await find();
    if (winner) return winner;
    throw error;
  }
}

async function highestEmployeeId(): Promise<number> {
  const client = await getRayfinClient();
  const [top] = await client.data.Employee.select(['EmployeeID'])
    .orderBy({ EmployeeID: 'desc' })
    .first(1)
    .execute();
  return top?.EmployeeID ?? 0;
}

async function emailInUse(email: string, exceptId?: string): Promise<boolean> {
  const client = await getRayfinClient();
  const matches = await client.data.Employee.select(['id'])
    .where({ Email: { eq: email } })
    .execute();
  return matches.some((row) => row.id !== exceptId);
}

function duplicateEmail(email: string) {
  return new EmployeeConflictError(
    `Another employee already uses ${email}. Each email must be unique.`
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error && /same unique value|duplicate key/i.test(error.message)
  );
}

// ---------------------------------------------------------------------------
// Form validation — mirrors the `Employee` entity constraints.
// ---------------------------------------------------------------------------

export interface EmployeeFormValues {
  FullName: string;
  Email: string;
  Department: string;
  JobTitle: string;
  Salary: string;
  JoiningDate: string;
}

export type EmployeeFormErrors = Partial<Record<keyof EmployeeFormValues, string>>;

export const EMPTY_FORM: EmployeeFormValues = {
  FullName: '',
  Email: '',
  Department: '',
  JobTitle: '',
  Salary: '',
  JoiningDate: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALARY_PATTERN = /^\d+(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toFormValues(employee: EmployeeRecord): EmployeeFormValues {
  return {
    FullName: employee.FullName,
    Email: employee.Email,
    Department: employee.Department,
    JobTitle: employee.JobTitle,
    Salary: String(employee.Salary),
    JoiningDate: toDateInput(employee.JoiningDate),
  };
}

export type EditableField = keyof EmployeeFormValues;

export const FIELD_LABELS: Record<EditableField, string> = {
  FullName: 'Full name',
  Email: 'Email',
  Department: 'Department',
  JobTitle: 'Job title',
  Salary: 'Salary',
  JoiningDate: 'Joining date',
};

const TEXT_LIMITS = {
  FullName: EMPLOYEE_LIMITS.FullName,
  Department: EMPLOYEE_LIMITS.Department,
  JobTitle: EMPLOYEE_LIMITS.JobTitle,
} as const;

/** Validates and converts one raw input value into its stored type. */
export function validateField<K extends EditableField>(
  key: K,
  raw: string
):
  | { value: EmployeeInput[K]; error?: undefined }
  | { value?: undefined; error: string } {
  const label = FIELD_LABELS[key];
  switch (key) {
    case 'FullName':
    case 'Department':
    case 'JobTitle': {
      const value = raw.trim();
      const max = TEXT_LIMITS[key as keyof typeof TEXT_LIMITS];
      if (!value) return { error: `${label} is required.` };
      if (value.length > max)
        return { error: `${label} must be ${max} characters or fewer.` };
      return { value: value as EmployeeInput[K] };
    }
    case 'Email': {
      const value = raw.trim().toLowerCase();
      if (!value) return { error: 'Email is required.' };
      if (value.length > EMPLOYEE_LIMITS.Email || !EMAIL_PATTERN.test(value))
        return { error: 'Enter a valid email address, like name@company.com.' };
      return { value: value as EmployeeInput[K] };
    }
    case 'Salary': {
      const text = raw.trim().replace(/,/g, '');
      if (!text) return { error: 'Salary is required.' };
      if (!SALARY_PATTERN.test(text))
        return { error: 'Enter a positive amount with up to 2 decimal places.' };
      const value = Number(text);
      if (value > EMPLOYEE_LIMITS.SalaryMax)
        return { error: 'Salary is larger than the database column allows.' };
      return { value: value as EmployeeInput[K] };
    }
    case 'JoiningDate': {
      if (!raw) return { error: 'Joining date is required.' };
      const value = fromDateInput(raw);
      if (!value) return { error: 'Enter a valid date.' };
      return { value: value as EmployeeInput[K] };
    }
  }
  return { error: `${label} cannot be edited.` };
}

export function validateEmployee(
  values: EmployeeFormValues
):
  | { value: EmployeeInput; errors?: undefined }
  | { value?: undefined; errors: EmployeeFormErrors } {
  const errors: EmployeeFormErrors = {};
  const value: Partial<EmployeeInput> = {};
  for (const key of Object.keys(FIELD_LABELS) as EditableField[]) {
    const result = validateField(key, values[key]);
    if (result.error !== undefined) errors[key] = result.error;
    else (value as Record<string, unknown>)[key] = result.value;
  }
  if (Object.keys(errors).length > 0) return { errors };
  return { value: value as EmployeeInput };
}

/** Joining dates are calendar days, stored as midnight UTC. */
export function fromDateInput(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  // Reject days the calendar doesn't have (2026-02-30 would roll to March).
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function toDateInput(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
