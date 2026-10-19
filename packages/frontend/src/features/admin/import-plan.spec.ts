//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import { planImport } from './import-plan';

const existing: EmployeeRecord[] = [
  {
    id: 'a',
    EmployeeID: 1,
    FullName: 'Ada Park',
    Email: 'ada@contoso.com',
    Department: 'Engineering',
    JobTitle: 'Engineer',
    Salary: 100,
    JoiningDate: new Date('2024-01-15T00:00:00Z'),
    CreatedAt: new Date(),
  },
];
const header = ['EmployeeID', 'FullName', 'Email', 'Department', 'JobTitle', 'Salary', 'JoiningDate'];

describe('planImport', () => {
  it('rejects a file missing required columns', () => {
    const plan = planImport([['FullName', 'Email'], ['A', 'a@b.co']], existing);
    expect(plan.fileErrors[0]).toMatch(/Department, JobTitle, Salary, JoiningDate/);
    expect(plan.rows).toEqual([]);
  });

  it('classifies new, changed and unchanged rows, sending only changed fields', () => {
    const plan = planImport(
      [
        header,
        ['1', 'Ada Park', 'ada@contoso.com', 'Engineering', 'Engineer', '100', '2024-01-15'],
        ['', 'Ravi Shah', 'ravi@contoso.com', 'Finance', 'Analyst', '80', '2025-06-01'],
      ],
      existing
    );
    expect(plan.counts).toEqual({ create: 1, update: 0, unchanged: 1, error: 0 });

    const changed = planImport([header, ['EMP-0001', 'Ada Park', 'ada@contoso.com', 'Engineering', 'Lead', '150', '2024-01-15']], existing);
    expect(changed.rows[0]).toMatchObject({ kind: 'update', changes: { JobTitle: 'Lead', Salary: 150 } });
  });

  it('flags duplicate IDs and emails within the file and clashes with stored emails', () => {
    const plan = planImport(
      [
        header,
        ['7', 'One', 'x@contoso.com', 'D', 'T', '1', '2024-01-01'],
        ['7', 'Two', 'x@contoso.com', 'D', 'T', '1', '2024-01-01'],
        ['', 'Three', 'ADA@contoso.com', 'D', 'T', '1', '2024-01-01'],
      ],
      existing
    );
    expect(plan.counts.error).toBe(2);
    expect(plan.rows[1]!.issues.join(' ')).toMatch(/also appears on line 2/);
    expect(plan.rows[2]!.issues.join(' ')).toMatch(/already used by Ada Park/);
  });

  it('reports field errors per row', () => {
    const plan = planImport([header, ['x', '', 'bad', 'D', 'T', '-1', '2024-13-01']], existing);
    const issues = plan.rows[0]!.issues.join(' ');
    expect(issues).toMatch(/Full name/);
    expect(issues).toMatch(/Email/);
    expect(issues).toMatch(/Salary/);
    expect(issues).toMatch(/Employee ID/);
  });
});
