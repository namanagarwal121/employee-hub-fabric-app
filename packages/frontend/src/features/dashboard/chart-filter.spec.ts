//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { InteractionEvent } from '@microsoft/fabric-visuals-core';
import type { EmployeeRecord } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import { filterFromInteraction, matchesFilter } from './chart-filter';
import { computeMetrics } from './metrics';

const row = (id: number, Department: string, Salary: number, JoiningDate: string): EmployeeRecord => ({
  id: String(id),
  EmployeeID: id,
  FullName: `P${id}`,
  Email: `p${id}@c.com`,
  Department,
  JobTitle: 'R',
  Salary,
  JoiningDate: new Date(`${JoiningDate}T00:00:00Z`),
  CreatedAt: new Date(),
});

const rows = [
  row(1, 'Engineering', 100000, '2024-01-15'),
  row(2, 'Finance', 80000, '2024-03-02'),
  row(3, 'Engineering', 60000, '2024-03-20'),
];
const metrics = computeMetrics(rows);

const select = (predicates: { name: string; values: unknown[] }[]): InteractionEvent[] => [
  { action: 'select', selections: [{ predicates: predicates.map((p) => ({ type: 'set', ...p })) }] },
];

describe('filterFromInteraction', () => {
  it('maps a department bar to the same rows it counted', () => {
    const f = filterFromInteraction('department', select([{ name: 'department', values: ['Engineering'] }]), metrics)!;
    expect(rows.filter((r) => matchesFilter(r, f)).map((r) => r.id)).toEqual(['1', '3']);
  });

  it('maps a salary band by its start', () => {
    const band = metrics.salaryBins.find((b) => b.count > 0)!;
    const f = filterFromInteraction('salary', select([{ name: 'start', values: [band.start] }]), metrics)!;
    expect(rows.filter((r) => matchesFilter(r, f))).toHaveLength(band.count);
  });

  it('maps a month bar from a string or a timestamp', () => {
    for (const value of ['2024-03-01', Date.UTC(2024, 2, 1)]) {
      const f = filterFromInteraction('joined', select([{ name: 'month', values: [value] }]), metrics)!;
      expect(rows.filter((r) => matchesFilter(r, f)).map((r) => r.id)).toEqual(['2', '3']);
    }
  });

  it('ignores clear events and unknown bars', () => {
    expect(filterFromInteraction('department', [{ action: 'clear' }], metrics)).toBeNull();
    expect(filterFromInteraction('salary', select([{ name: 'start', values: [123] }]), metrics)).toBeNull();
  });
});
