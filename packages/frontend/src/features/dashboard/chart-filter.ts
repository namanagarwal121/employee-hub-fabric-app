//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { InteractionEvent } from '@microsoft/fabric-visuals-core';
import type { EmployeeRecord } from '@rayfin-app/shared';

import type { DashboardMetrics } from './metrics';

/** The rows behind one clicked bar, applied as a filter in Data Management. */
export type ChartFilter =
  | { kind: 'department'; department: string; label: string }
  | { kind: 'salary'; start: number; end: number; label: string }
  | { kind: 'joined'; month: string; label: string };

export type ChartId = 'department' | 'salary' | 'joined';

const monthLabel = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Reads the clicked bar from a chart's interaction events. Returns null for a
 * clear event or a selection that does not identify one of the chart's bars.
 */
export function filterFromInteraction(
  chart: ChartId,
  events: readonly InteractionEvent[],
  metrics: DashboardMetrics
): ChartFilter | null {
  const select = [...events].reverse().find((e) => e.action === 'select');
  if (!select || select.action !== 'select') return null;
  const predicates = select.selections[0]?.predicates ?? [];
  const value = (name: string): unknown => {
    const p = predicates.find((x) => x.name === name);
    if (!p) return undefined;
    return p.type === 'set' ? p.values[0] : p.min;
  };

  switch (chart) {
    case 'department': {
      const department = value('department');
      if (typeof department !== 'string') return null;
      return { kind: 'department', department, label: `Department: ${department}` };
    }
    case 'salary': {
      const start = Number(value('start'));
      const band = metrics.salaryBins.find((b) => b.start === start || b.label === value('band'));
      if (!band) return null;
      return { kind: 'salary', start: band.start, end: band.end, label: `Salary: ${band.label}` };
    }
    case 'joined': {
      const month = toMonthKey(value('month') ?? value('utcyearmonth_month'));
      if (!month) return null;
      return {
        kind: 'joined',
        month,
        label: `Joined: ${monthLabel.format(new Date(`${month}-01T00:00:00Z`))}`,
      };
    }
  }
}

function toMonthKey(raw: unknown): string | null {
  if (typeof raw === 'string' && /^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
  const date = raw instanceof Date ? raw : typeof raw === 'number' ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Uses the same rules the dashboard used to count the bar. */
export function matchesFilter(employee: EmployeeRecord, filter: ChartFilter): boolean {
  switch (filter.kind) {
    case 'department':
      return employee.Department.trim() === filter.department;
    case 'salary': {
      const salary = Number(employee.Salary);
      return salary >= filter.start && salary < filter.end;
    }
    case 'joined':
      return toMonthKey(new Date(employee.JoiningDate)) === filter.month;
  }
}
