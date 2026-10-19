//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { VegaVisual, useCssTheme } from '@microsoft/fabric-visuals';
import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { DataTable, InteractionEvent } from '@microsoft/fabric-visuals-core';
import {
  Banknote,
  Building2,
  CircleAlert,
  MousePointerClick,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { useEmployees } from '@/features/employees/employees.context';
import { formatSalary, formatTimestamp } from '@/features/employees/format';
import { PageHeader, RefreshButton } from '@/features/shell/PageHeader';

import { ColorGridPicker } from './ColorGridPicker';
import { filterFromInteraction, type ChartFilter, type ChartId } from './chart-filter';
import { computeMetrics } from './metrics';

const count = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function Dashboard({
  chartColor,
  onChartColorChange,
  onDrill,
}: {
  /** The bar colour, or null for the theme default. */
  readonly chartColor: string | null;
  readonly onChartColorChange: (color: string | null) => void;
  /** Called with the rows behind a clicked bar. */
  readonly onDrill: (filter: ChartFilter) => void;
}) {
  const { employees, load, refreshing, refresh } = useEmployees();
  const metrics = useMemo(() => computeMetrics(employees), [employees]);
  const theme = useCssTheme();

  const departmentData = useMemo<DataTable>(
    () => ({
      columns: [
        { name: 'department', displayName: 'Department' },
        { name: 'employees', displayName: 'Employees', format: '#,0' },
      ],
      rows: metrics.byDepartment.map((d) => [d.department, d.count]),
    }),
    [metrics]
  );

  const salaryData = useMemo<DataTable>(
    () => ({
      columns: [
        { name: 'band', displayName: 'Salary band' },
        { name: 'start', displayName: 'Band start', format: '#,0' },
        { name: 'employees', displayName: 'Employees', format: '#,0' },
      ],
      rows: metrics.salaryBins.map((b) => [b.label, b.start, b.count]),
    }),
    [metrics]
  );

  const joiningData = useMemo<DataTable>(
    () => ({
      columns: [
        { name: 'month', displayName: 'Month' },
        { name: 'joined', displayName: 'Employees joined', format: '#,0' },
      ],
      rows: metrics.joiningByMonth.map((m) => [m.month, m.count]),
    }),
    [metrics]
  );

  const joiningSpec = useMemo<VisualizationSpec>(
    () => ({
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      encoding: {
        x: {
          field: 'month',
          type: 'temporal',
          timeUnit: 'utcyearmonth',
          axis: { format: '%b %Y', labelOverlap: true, title: null },
        },
        y: { field: 'joined', type: 'quantitative', axis: { tickMinStep: 1 } },
      },
      // Months with no joiners stay at zero, so columns read better than a line.
      layer: [
        { mark: { type: 'bar', cornerRadiusEnd: 2, cursor: 'pointer', ...fill(chartColor) } },
        ...(metrics.joiningByMonth.length <= 24
          ? [
              {
                mark: { type: 'text' as const, style: 'labelVertical' },
                encoding: {
                  text: { field: 'joined', type: 'quantitative' as const },
                  opacity: { condition: { test: 'datum.joined === 0', value: 0 }, value: 1 },
                },
              },
            ]
          : []),
      ],
    }),
    [metrics, chartColor]
  );

  const departmentSpec = useMemo(() => departmentSpecFor(chartColor), [chartColor]);
  const salarySpec = useMemo(() => salarySpecFor(chartColor), [chartColor]);

  const drill = (chart: ChartId) => (events: InteractionEvent[]) => {
    const filter = filterFromInteraction(chart, events, metrics);
    if (filter) onDrill(filter);
  };

  const header = (
    <PageHeader
      title="Dashboard"
      description={
        load.kind === 'ready'
          ? `Calculated from ${count.format(metrics.totalEmployees)} records in the Employees table · updated ${formatTimestamp(load.loadedAt)}`
          : 'Calculated live from the Employees table'
      }
      actions={
        <>
          <ColorGridPicker value={chartColor} onChange={onChartColorChange} />
          <RefreshButton refreshing={refreshing} onClick={() => void refresh()} />
        </>
      }
    />
  );

  if (load.kind === 'loading') {
    return (
      <>
        {header}
        <div role="status" aria-label="Loading dashboard" className="grid gap-400 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
          <div className="h-80 animate-pulse rounded-xl bg-muted sm:col-span-2" />
          <div className="h-80 animate-pulse rounded-xl bg-muted sm:col-span-2" />
        </div>
      </>
    );
  }

  if (load.kind === 'error') {
    return (
      <>
        {header}
        <div role="alert" className="flex flex-col items-center gap-300 rounded-xl border border-border bg-card px-600 py-800 text-center">
          <CircleAlert className="icon-size-600 text-destructive" aria-hidden="true" />
          <p className="text-400 font-semibold">The dashboard could not be calculated</p>
          <p className="max-w-md text-300 text-muted-foreground">{load.message}</p>
        </div>
      </>
    );
  }

  const empty = metrics.totalEmployees === 0;

  return (
    <>
      {header}

      <section aria-label="Key figures" className="grid gap-400 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Total employees" value={count.format(metrics.totalEmployees)} />
        <Kpi
          icon={Banknote}
          label="Average salary"
          value={metrics.averageSalary === null ? '—' : formatSalary(metrics.averageSalary)}
        />
        <Kpi icon={Building2} label="Departments" value={count.format(metrics.departmentCount)} />
        <Kpi
          icon={Trophy}
          label="Highest salary"
          value={metrics.highest ? formatSalary(metrics.highest.salary) : '—'}
          hint={metrics.highest?.name}
        />
      </section>

      {empty ? null : (
        <p className="-mb-200 flex items-center gap-200 text-200 text-muted-foreground">
          <MousePointerClick className="icon-size-200" aria-hidden="true" />
          Click any bar to open the employees behind it in Data Management.
        </p>
      )}

      <div className="grid gap-400 lg:grid-cols-5">
        <ChartCard
          title="Employees by department"
          className="lg:col-span-2"
          empty={empty}
        >
          <VegaVisual
            spec={departmentSpec}
            data={departmentData}
            theme={theme}
            onInteraction={drill('department')}
            style={{ height: Math.max(220, metrics.byDepartment.length * 40 + 60) }}
          />
        </ChartCard>
        <ChartCard
          title="Salary distribution"
          subtitle="Employees per salary band"
          className="lg:col-span-3"
          empty={empty}
        >
          <VegaVisual
            spec={salarySpec}
            data={salaryData}
            theme={theme}
            onInteraction={drill('salary')}
            style={{ height: 300 }}
          />
        </ChartCard>
        <ChartCard
          title="Employees joining over time"
          subtitle="Monthly count by joining date"
          className="lg:col-span-5"
          empty={empty}
        >
          <VegaVisual
            spec={joiningSpec}
            data={joiningData}
            theme={theme}
            onInteraction={drill('joined')}
            style={{ height: 280 }}
          />
        </ChartCard>
      </div>
    </>
  );
}

/** Bar fill for the chosen colour; omitted to keep the theme's default. */
function fill(color: string | null) {
  return color ? { color } : {};
}

function departmentSpecFor(color: string | null): VisualizationSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    encoding: {
      y: { field: 'department', type: 'nominal', sort: '-x', axis: { title: null } },
      x: { field: 'employees', type: 'quantitative', axis: { tickMinStep: 1 } },
    },
    layer: [
      { mark: { type: 'bar', cornerRadiusEnd: 3, cursor: 'pointer', ...fill(color) } },
      {
        mark: { type: 'text', style: 'labelHorizontal' },
        encoding: { text: { field: 'employees', type: 'quantitative' } },
      },
    ],
  };
}

function salarySpecFor(color: string | null): VisualizationSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    encoding: {
      x: {
        field: 'band',
        type: 'ordinal',
        sort: { field: 'start', op: 'min', order: 'ascending' },
        axis: { labelAngle: 0, labelOverlap: true },
      },
      y: { field: 'employees', type: 'quantitative', axis: { tickMinStep: 1 } },
    },
    layer: [
      { mark: { type: 'bar', cornerRadiusEnd: 3, cursor: 'pointer', ...fill(color) } },
      {
        mark: { type: 'text', style: 'labelVertical' },
        encoding: { text: { field: 'employees', type: 'quantitative' } },
      },
    ],
  };
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <div className="flex flex-col gap-200 rounded-xl border border-border bg-card p-500">
      <div className="flex items-center justify-between gap-200">
        <p className="text-300 font-medium text-muted-foreground">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="icon-size-200" aria-hidden="true" />
        </span>
      </div>
      <p className="font-numeric text-hero-700 leading-hero-700 font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="min-h-200 truncate text-200 text-muted-foreground">{hint ?? ' '}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  className,
  empty,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly className?: string;
  readonly empty: boolean;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col gap-300 rounded-xl border border-border bg-card p-500 ${className ?? ''}`}
    >
      <div>
        <h2 className="text-400 font-semibold">{title}</h2>
        {subtitle ? <p className="text-200 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {empty ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-300 text-muted-foreground">
          No employee records yet
        </div>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </section>
  );
}
