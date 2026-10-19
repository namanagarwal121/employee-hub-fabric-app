//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  Filter,
  LayoutDashboard,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { useAccess } from '@/features/access/access.context';
import { matchesFilter, type ChartFilter } from '@/features/dashboard/chart-filter';
import { PageHeader, RefreshButton } from '@/features/shell/PageHeader';
import { cn } from '@/lib/utils';
import {
  EMPTY_FORM,
  FIELD_LABELS,
  toDateInput,
  type EditableField,
  type EmployeeInput,
} from '@/services/employees.service';

import { EmployeeForm } from './EmployeeForm';
import { EditableRow, ReadOnlyRow } from './FieldRow';
import { Modal } from './Modal';
import { errorMessage, useEmployees } from './employees.context';
import { formatDay, formatEmployeeId, formatSalary, formatTimestamp } from './format';

export function DataManagement({
  filter,
  onClearFilter,
  onBackToDashboard,
}: {
  /** Rows behind a dashboard bar; null shows everyone. */
  readonly filter: ChartFilter | null;
  readonly onClearFilter: () => void;
  readonly onBackToDashboard: () => void;
}) {
  const { employees, load, refreshing, refresh, create, notify } = useEmployees();
  const { can } = useAccess();
  const canWrite = can('writeEmployees');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.Department.trim()))].sort((a, b) => a.localeCompare(b)),
    [employees]
  );

  const scoped = useMemo(
    () => (filter ? employees.filter((e) => matchesFilter(e, filter)) : employees),
    [employees, filter]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return scoped;
    const digits = term.replace(/^emp-?0*/, '');
    return scoped.filter(
      (e) =>
        e.FullName.toLowerCase().includes(term) ||
        formatEmployeeId(e.EmployeeID).toLowerCase().includes(term) ||
        (digits !== '' && /^\d+$/.test(digits) && String(e.EmployeeID).startsWith(digits))
    );
  }, [scoped, search]);

  // The panel follows the live list, so a refresh shows the database's values.
  const selected = selectedId ? employees.find((e) => e.id === selectedId) ?? null : null;

  const addEmployee = async (value: EmployeeInput): Promise<string | null> => {
    try {
      const saved = await create(value);
      setAdding(false);
      setSelectedId(saved.id);
      notify({
        tone: 'success',
        text: `${saved.FullName} was added as ${formatEmployeeId(saved.EmployeeID)}.`,
      });
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Data Management"
        description={
          canWrite
            ? 'Select an employee to view and edit their record. Every change is saved straight to the Employees table.'
            : 'Select an employee to view their record. Your role is read-only.'
        }
        actions={
          <>
            <RefreshButton refreshing={refreshing} onClick={() => void refresh()} />
            {canWrite ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-10 items-center gap-200 rounded-lg bg-primary px-400 text-300 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Plus className="icon-size-200" aria-hidden="true" />
              Add employee
            </button>
            ) : null}
          </>
        }
      />

      {filter ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-300 rounded-xl border border-primary/30 bg-primary/5 px-400 py-300"
        >
          <Filter className="icon-size-200 text-primary" aria-hidden="true" />
          <p className="text-300">
            Showing the {scoped.length} {scoped.length === 1 ? 'employee' : 'employees'} behind the
            dashboard bar
          </p>
          <span className="inline-flex items-center gap-100 rounded-full border border-primary/30 bg-card py-100 pr-100 pl-300 text-200 font-semibold text-primary">
            {filter.label}
            <button
              type="button"
              onClick={onClearFilter}
              aria-label={`Clear filter ${filter.label}`}
              className="rounded-full p-100 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="icon-size-100" aria-hidden="true" />
            </button>
          </span>
          <div className="ml-auto flex gap-200">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex h-8 items-center gap-100 rounded-lg px-300 text-200 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <LayoutDashboard className="icon-size-100" aria-hidden="true" />
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={onClearFilter}
              className="h-8 rounded-lg border border-input bg-card px-300 text-200 font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              Show all employees
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-400 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <section
          aria-label="Employees"
          className={cn(
            'flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card',
            selected && 'hidden lg:flex'
          )}
        >
          <div className="border-b border-border p-300">
            <label htmlFor="employee-search" className="sr-only">
              Search by employee ID or name
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-300 icon-size-200 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="employee-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID or name"
                className="h-10 w-full rounded-lg border border-input bg-background pr-300 pl-800 text-300 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
          </div>

          {load.kind === 'ready' ? (
            <p aria-live="polite" className="border-b border-border px-400 py-200 text-200 text-muted-foreground">
              {visible.length === employees.length
                ? `${employees.length} ${employees.length === 1 ? 'employee' : 'employees'}`
                : `${visible.length} of ${employees.length} employees`}
              {filter ? ' · filtered' : ''}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100vh-240px)]">
            {load.kind === 'loading' ? (
              <div role="status" aria-label="Loading employees" className="space-y-200 p-300">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : load.kind === 'error' ? (
              <div role="alert" className="flex flex-col items-center gap-200 px-500 py-800 text-center">
                <CircleAlert className="icon-size-500 text-destructive" aria-hidden="true" />
                <p className="text-300 font-semibold">Employees could not be loaded</p>
                <p className="text-200 text-muted-foreground">{load.message}</p>
              </div>
            ) : visible.length === 0 ? (
              <p className="px-500 py-800 text-center text-300 text-muted-foreground">
                {employees.length === 0
                  ? 'No employees yet. Add one, or insert rows into the Employees table and refresh.'
                  : filter && scoped.length === 0
                    ? 'No employees match this dashboard bar any more. The data may have changed since you clicked it.'
                    : 'No employee matches that ID or name.'}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((e) => {
                  const active = e.id === selectedId;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(e.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center gap-300 px-400 py-300 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                          active ? 'bg-primary/10' : 'hover:bg-accent'
                        )}
                      >
                        <span
                          className={cn(
                            'w-20 shrink-0 font-monospace text-200 font-semibold tracking-wide',
                            active ? 'text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {formatEmployeeId(e.EmployeeID)}
                        </span>
                        <span className={cn('min-w-0 flex-1 truncate text-300', active && 'font-semibold')}>
                          {e.FullName}
                        </span>
                        <ChevronRight className="icon-size-200 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {selected ? (
          <EmployeeDetails
            key={selected.id}
            employee={selected}
            departments={departments}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="hidden flex-col items-center justify-center gap-300 rounded-xl border border-dashed border-border px-600 py-800 text-center lg:flex">
            <UserRound className="icon-size-700 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-400 font-semibold">No employee selected</p>
            <p className="max-w-sm text-300 text-muted-foreground">
              Choose someone from the list to see their full record and edit individual fields.
            </p>
          </div>
        )}
      </div>

      {adding ? (
        <Modal
          title="Add employee"
          description="An employee ID and created time are assigned when you save."
          onClose={() => setAdding(false)}
        >
          <EmployeeForm
            initial={EMPTY_FORM}
            departments={departments}
            submitLabel="Add employee"
            onSubmit={addEmployee}
            onCancel={() => setAdding(false)}
          />
        </Modal>
      ) : null}
    </>
  );
}

function EmployeeDetails({
  employee,
  departments,
  onClose,
}: {
  readonly employee: EmployeeRecord;
  readonly departments: readonly string[];
  readonly onClose: () => void;
}) {
  const { update, remove, notify } = useEmployees();
  const canWrite = useAccess().can('writeEmployees');
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const save =
    <K extends EditableField>(field: K) =>
    async (value: EmployeeInput[K]): Promise<string | null> => {
      try {
        // Only the edited column is sent, keyed by the row's primary key.
        await update(employee.id, { [field]: value } as Pick<EmployeeInput, K>);
        setEditing(null);
        notify({ tone: 'success', text: `${FIELD_LABELS[field]} for ${employee.FullName} was saved.` });
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(employee.id);
      setConfirming(false);
      notify({
        tone: 'success',
        text: `${employee.FullName} (${formatEmployeeId(employee.EmployeeID)}) was deleted.`,
      });
      onClose();
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeleting(false);
    }
  };

  const row = <K extends EditableField>(field: K, display: string, rawValue: string, suggestions?: readonly string[]) =>
    canWrite ? (
    <EditableRow
      field={field}
      display={display}
      rawValue={rawValue}
      editing={editing === field}
      disabled={editing !== null && editing !== field}
      suggestions={suggestions}
      onEdit={() => setEditing(field)}
      onCancel={() => setEditing(null)}
      onSave={save(field)}
    />
    ) : (
      <ReadOnlyRow label={FIELD_LABELS[field]} value={display} reason="Your role can view but not edit employee records." />
    );

  return (
    <section
      aria-label={`${employee.FullName} details`}
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card"
    >
      <div className="flex items-start gap-400 border-b border-border p-500">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to employee list"
          className="-ml-200 rounded-lg p-200 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
        >
          <ArrowLeft className="icon-size-300" aria-hidden="true" />
        </button>
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-400 font-semibold text-primary"
        >
          {initials(employee.FullName)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-500 leading-500 font-semibold">{employee.FullName}</h2>
          <p className="truncate text-300 text-muted-foreground">
            {employee.JobTitle} · {employee.Department}
          </p>
        </div>
        <span className="rounded-md border border-border bg-muted px-200 py-100 font-monospace text-200 font-semibold tracking-wide">
          {formatEmployeeId(employee.EmployeeID)}
        </span>
      </div>

      <div className="grid gap-500 p-500 xl:grid-cols-2">
        <FieldGroup title="Identity">
          <ReadOnlyRow
            label="Employee ID"
            value={formatEmployeeId(employee.EmployeeID)}
            reason="Employee IDs are assigned automatically and cannot be changed."
          />
          {row('FullName', employee.FullName, employee.FullName)}
          {row('Email', employee.Email, employee.Email)}
        </FieldGroup>
        <FieldGroup title="Employment">
          {row('Department', employee.Department, employee.Department, departments)}
          {row('JobTitle', employee.JobTitle, employee.JobTitle)}
          {row('Salary', formatSalary(employee.Salary), String(employee.Salary))}
          {row('JoiningDate', formatDay(employee.JoiningDate), toDateInput(employee.JoiningDate))}
        </FieldGroup>
        <FieldGroup title="Record history" className="xl:col-span-2">
          <div className="grid gap-x-500 xl:grid-cols-2">
            <ReadOnlyRow
              label="Created at"
              value={formatTimestamp(employee.CreatedAt)}
              reason="Created At records when this row was inserted."
            />
            <ReadOnlyRow
              label="Created by"
              value={employee.CreatedBy ?? 'Not recorded'}
              reason="The signed-in user who added this record. Older records and rows inserted with SQL have no recorded author."
            />
            <ReadOnlyRow
              label="Last updated"
              value={employee.UpdatedAt ? formatTimestamp(employee.UpdatedAt) : 'Not edited yet'}
              reason="When this record was last edited in the app."
            />
            <ReadOnlyRow
              label="Last updated by"
              value={employee.UpdatedBy ?? (employee.UpdatedAt ? 'Not recorded' : 'Not edited yet')}
              reason="The signed-in user who last edited this record in the app."
            />
          </div>
        </FieldGroup>
      </div>

      {canWrite ? (
      <div className="mt-auto border-t border-border p-500">
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setConfirming(true);
          }}
          disabled={editing !== null}
          className="inline-flex h-11 w-full items-center justify-center gap-200 rounded-lg bg-destructive px-500 text-300 font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:opacity-50"
        >
          <Trash2 className="icon-size-200" aria-hidden="true" />
          Delete Record
        </button>
      </div>
      ) : null}

      {confirming ? (
        <Modal
          role="alertdialog"
          title="Delete this record?"
          onClose={() => !deleting && setConfirming(false)}
          className="max-w-md"
        >
          <p className="text-300 leading-300">
            You are about to permanently delete{' '}
            <strong>
              {employee.FullName} ({formatEmployeeId(employee.EmployeeID)})
            </strong>{' '}
            from the Employees table. This can’t be undone.
          </p>
          {deleteError ? (
            <p role="alert" className="mt-400 rounded-lg border border-destructive/40 bg-destructive/10 px-400 py-300 text-300 text-destructive">
              Could not delete: {deleteError}
            </p>
          ) : null}
          <div className="mt-600 flex justify-end gap-300">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              autoFocus
              className="h-10 rounded-lg px-500 text-300 font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="h-10 rounded-lg bg-destructive px-500 text-300 font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Yes, delete record'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function FieldGroup({
  title,
  className,
  children,
}: {
  readonly title: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={className}>
      <h3 className="mb-100 px-300 text-200 font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      <dl className="flex flex-col gap-100">{children}</dl>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase();
}
