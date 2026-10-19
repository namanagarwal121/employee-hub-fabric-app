//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import { computeMetrics, joiningByMonth, salaryBins } from './metrics';

const row = (
  EmployeeID: number,
  Department: string,
  Salary: number,
  JoiningDate: string
): EmployeeRecord => ({
  id: String(EmployeeID),
  EmployeeID,
  FullName: `Person ${EmployeeID}`,
  Email: `p${EmployeeID}@contoso.com`,
  Department,
  JobTitle: 'Role',
  Salary,
  JoiningDate: new Date(`${JoiningDate}T00:00:00Z`),
  CreatedAt: new Date(),
});

describe('computeMetrics', () => {
  it('derives every KPI from the rows', () => {
    const m = computeMetrics([
      row(1, 'Engineering', 100000, '2024-01-15'),
      row(2, 'Engineering ', 80000, '2024-03-02'),
      row(3, 'Finance', 60000, '2024-03-20'),
    ]);
    expect(m.totalEmployees).toBe(3);
    expect(m.averageSalary).toBe(80000);
    expect(m.departmentCount).toBe(2);
    expect(m.highest).toEqual({ salary: 100000, name: 'Person 1' });
    expect(m.byDepartment).toEqual([
      { department: 'Engineering', count: 2 },
      { department: 'Finance', count: 1 },
    ]);
    expect(m.joiningByMonth).toEqual([
      { month: '2024-01-01', count: 1 },
      { month: '2024-02-01', count: 0 },
      { month: '2024-03-01', count: 2 },
    ]);
    expect(m.salaryBins.reduce((n, b) => n + b.count, 0)).toBe(3);
  });

  it('handles an empty table without inventing values', () => {
    const m = computeMetrics([]);
    expect(m).toMatchObject({
      totalEmployees: 0,
      averageSalary: null,
      departmentCount: 0,
      highest: null,
      byDepartment: [],
      salaryBins: [],
      joiningByMonth: [],
    });
  });
});

describe('salaryBins', () => {
  it('puts the maximum salary inside the last band', () => {
    const bins = salaryBins([50000, 75000, 120000]);
    const last = bins[bins.length - 1]!;
    expect(last.start).toBeLessThanOrEqual(120000);
    expect(last.end).toBeGreaterThan(120000);
  });

  it('gives identical salaries a single band', () => {
    expect(salaryBins([70000, 70000])).toHaveLength(1);
  });
});

describe('joiningByMonth', () => {
  it('ignores invalid dates', () => {
    expect(joiningByMonth([new Date('nope')])).toEqual([]);
  });
});
