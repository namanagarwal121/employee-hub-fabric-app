/**
 * Browser-safe contracts shared by the data registration package and frontend.
 *
 * Keep each row shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */

export interface DepartmentRecord {
  id: string;
  Name: string;
}

export interface JobTitleRecord {
  id: string;
  Title: string;
}

export interface AppUserRecord {
  id: string;
  Email: string;
  FirstSeenAt: Date;
}

/** A row of the Employees table, with its links to the lookup tables. */
export interface EmployeeRow {
  id: string;
  EmployeeID: number;
  FullName: string;
  Email: string;
  Salary: number;
  JoiningDate: Date;
  CreatedAt: Date;
  UpdatedAt?: Date | null;
  dept_id: string;
  dept?: DepartmentRecord | null;
  title_id: string;
  title?: JobTitleRecord | null;
  createdBy_id?: string | null;
  createdBy?: AppUserRecord | null;
  updatedBy_id?: string | null;
  updatedBy?: AppUserRecord | null;
}

/**
 * One employee as the screens use it: the linked department, job title and
 * audit users resolved to their display values.
 */
export interface EmployeeRecord {
  id: string;
  EmployeeID: number;
  FullName: string;
  Email: string;
  Department: string;
  JobTitle: string;
  Salary: number;
  JoiningDate: Date;
  CreatedAt: Date;
  /** Email of who added the row; null for rows that predate tracking or came from SQL. */
  CreatedBy?: string | null;
  /** Email of the last person to edit the row in the app. */
  UpdatedBy?: string | null;
  UpdatedAt?: Date | null;
}

/** Field limits mirrored from the entity decorators. */
export const EMPLOYEE_LIMITS = {
  FullName: 150,
  Email: 254,
  Department: 100,
  JobTitle: 150,
  /** DECIMAL(12,2) holds up to 10 integer digits. */
  SalaryMax: 9_999_999_999.99,
} as const;

export type UniversalAppSchema = {
  Department: DepartmentRecord;
  JobTitle: JobTitleRecord;
  AppUser: AppUserRecord;
  Employee: EmployeeRow;
  AuditEvent: AuditEventRecord;
};

export * from './access.js';

/** One append-only audit event. */
export interface AuditEventRecord {
  id: string;
  OccurredAt: Date;
  UserEmail: string;
  Action: string;
  EntityType: string;
  RecordId?: string | null;
  Status: 'success' | 'failure';
  Details?: string | null;
  ErrorDetails?: string | null;
}
