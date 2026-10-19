//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';

/** Everything the dashboard shows, derived from the rows the database returned. */
export interface DashboardMetrics {
  totalEmployees: number;
  /** Null when there are no employees to average. */
  averageSalary: number | null;
  departmentCount: number;
  highest: { salary: number; name: string } | null;
  byDepartment: { department: string; count: number }[];
  salaryBins: { label: string; start: number; end: number; count: number }[];
  /** One entry per calendar month from the earliest to the latest joining date. */
  joiningByMonth: { month: string; count: number }[];
}

export function computeMetrics(rows: readonly EmployeeRecord[]): DashboardMetrics {
  const salaries = rows.map((r) => Number(r.Salary));
  const total = salaries.reduce((sum, s) => sum + s, 0);

  const departments = new Map<string, number>();
  for (const r of rows) {
    const name = r.Department.trim();
    departments.set(name, (departments.get(name) ?? 0) + 1);
  }

  let highest: DashboardMetrics['highest'] = null;
  for (const r of rows) {
    const salary = Number(r.Salary);
    if (!highest || salary > highest.salary) highest = { salary, name: r.FullName };
  }

  return {
    totalEmployees: rows.length,
    averageSalary: rows.length ? total / rows.length : null,
    departmentCount: departments.size,
    highest,
    byDepartment: [...departments]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department)),
    salaryBins: salaryBins(salaries),
    joiningByMonth: joiningByMonth(rows.map((r) => new Date(r.JoiningDate))),
  };
}

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Equal-width salary bands on a "nice" step, about six of them. */
export function salaryBins(salaries: readonly number[], target = 6) {
  if (salaries.length === 0) return [];
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);
  const step = niceStep((max - min) / target || Math.max(max, 1) / target);
  const first = Math.floor(min / step) * step;
  const bins: DashboardMetrics['salaryBins'] = [];
  for (let start = first; start <= max; start += step) {
    const end = start + step;
    bins.push({
      label: `${compact.format(start)}–${compact.format(end)}`,
      start,
      end,
      count: salaries.filter((s) => s >= start && s < end).length,
    });
  }
  return bins;
}

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Joining dates are stored as midnight UTC, so months are counted in UTC. */
export function joiningByMonth(dates: readonly Date[]) {
  const valid = dates.filter((d) => !Number.isNaN(d.getTime()));
  if (valid.length === 0) return [];
  const key = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const counts = new Map<number, number>();
  for (const d of valid) counts.set(key(d), (counts.get(key(d)) ?? 0) + 1);
  const keys = [...counts.keys()];
  const out: { month: string; count: number }[] = [];
  for (let k = Math.min(...keys); k <= Math.max(...keys); k++) {
    const year = Math.floor(k / 12);
    const month = String((k % 12) + 1).padStart(2, '0');
    out.push({ month: `${year}-${month}-01`, count: counts.get(k) ?? 0 });
  }
  return out;
}
