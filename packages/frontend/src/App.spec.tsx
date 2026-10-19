//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A signed-in session for the access check; tests pick the email via `sessionEmail`.
const session = vi.hoisted(() => ({ email: 'naman@namanag1211outlook.onmicrosoft.com' }));
vi.mock('@/lib/rayfin-client', () => ({
  getRayfinClient: async () => ({
    auth: { getSession: () => ({ isAuthenticated: true, isAnonymous: false, user: { id: 'u', email: session.email } }) },
  }),
}));
// Treat one extra email as a Viewer, without changing the real role list.
vi.mock('@rayfin-app/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rayfin-app/shared')>();
  return {
    ...actual,
    assignmentFor: (email: string | null | undefined) =>
      email === 'viewer@contoso.com'
        ? { email, name: 'Vee', role: 'Viewer' as const, status: 'active' as const, addedAt: '2026-01-01' }
        : actual.assignmentFor(email),
  };
});
vi.mock('@/services/audit.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/audit.service')>();
  return { ...actual, logAudit: vi.fn(async () => true) };
});

// Stand-in chart: shows its rows and colour, and lets a test "click" a bar
// by sending the same interaction event the real chart emits.
vi.mock('@microsoft/fabric-visuals', () => ({
  VegaVisual: ({
    data,
    spec,
    onInteraction,
  }: {
    data: { columns: { name: string }[]; rows: unknown[][] };
    spec: { layer?: { mark?: { color?: string } }[] };
    onInteraction?: (events: unknown[]) => void;
  }) => (
    <div data-testid="chart" data-color={spec.layer?.[0]?.mark?.color ?? ''}>
      <pre>{JSON.stringify(data.rows)}</pre>
      {data.rows.map((r, i) => (
        <button
          key={i}
          type="button"
          onClick={() =>
            onInteraction?.([
              {
                action: 'select',
                selections: [
                  {
                    predicates: data.columns.map((c, j) => ({ type: 'set', name: c.name, values: [r[j]] })),
                  },
                ],
              },
            ])
          }
        >
          bar {String(r[0])}
        </button>
      ))}
    </div>
  ),
  useCssTheme: () => ({}),
}));

const seed: EmployeeRecord[] = [
  {
    id: 'a',
    EmployeeID: 1,
    FullName: 'Ada Park',
    Email: 'ada@contoso.com',
    Department: 'Engineering',
    JobTitle: 'Engineer',
    Salary: 120000,
    JoiningDate: new Date('2024-01-15T00:00:00Z'),
    CreatedAt: new Date('2026-10-19T09:00:00Z'),
  },
  {
    id: 'b',
    EmployeeID: 2,
    FullName: 'Ravi Shah',
    Email: 'ravi@contoso.com',
    Department: 'Finance',
    JobTitle: 'Analyst',
    Salary: 80000,
    JoiningDate: new Date('2024-03-01T00:00:00Z'),
    CreatedAt: new Date('2026-10-19T09:05:00Z'),
  },
];

let rows: EmployeeRecord[] = [];
const listEmployees = vi.fn(async () => rows.map((r) => ({ ...r })));
const updateEmployee = vi.fn(async (id: string, patch: Partial<EmployeeRecord>) => {
  rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
  // Like the real API, the response carries only the changed columns.
  return { id, ...patch } as EmployeeRecord;
});
const deleteEmployee = vi.fn(async (id: string) => {
  rows = rows.filter((r) => r.id !== id);
});

vi.mock('./services/employees.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/employees.service')>();
  return {
    ...actual,
    listEmployees: () => listEmployees(),
    updateEmployee: (id: string, patch: Partial<EmployeeRecord>) => updateEmployee(id, patch),
    deleteEmployee: (id: string) => deleteEmployee(id),
  };
});

import App from '@/App';

// jsdom has no native modal dialogs; open them the way a browser would.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};

beforeEach(() => {
  session.email = 'naman@namanag1211outlook.onmicrosoft.com';
  rows = seed.map((r) => ({ ...r }));
  window.location.hash = '';
  try {
    window.localStorage.clear();
  } catch {
    // No storage in this test environment.
  }
  vi.clearAllMocks();
});

async function openDataManagement() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Data Management' }));
  return screen.findByRole('button', { name: /Ada Park/ });
}

describe('Dashboard', () => {
  it('calculates KPIs from the loaded rows', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const kpis = await screen.findByRole('region', { name: 'Key figures' });
    expect(within(kpis).getByText('Total employees').parentElement?.parentElement).toHaveTextContent('2');
    expect(kpis).toHaveTextContent('100,000.00');
    expect(kpis).toHaveTextContent('120,000.00');
    expect(screen.getAllByTestId('chart')[0]).toHaveTextContent('[["Engineering",1],["Finance",1]]');
  });

  it('opens Data Management filtered to the clicked bar', async () => {
    render(<App />);
    await screen.findByText('Ravi Shah', {}, { timeout: 100 }).catch(() => undefined);
    fireEvent.click(await screen.findByRole('button', { name: 'bar Finance' }));
    expect(await screen.findByRole('heading', { name: 'Data Management' })).toBeVisible();
    expect(screen.getByText('Department: Finance')).toBeVisible();
    expect(screen.getByRole('button', { name: /Ravi Shah/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Ada Park/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show all employees' }));
    expect(screen.getByRole('button', { name: /Ada Park/ })).toBeVisible();
  });

  it('recolours every chart from the colour grid', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Chart colour/ }));
    const swatch = within(screen.getByRole('grid', { name: 'Colour swatches' })).getAllByRole('gridcell')[60]!;
    const hex = swatch.getAttribute('aria-label')!.split(' ').pop()!;
    fireEvent.click(swatch);
    for (const chart of screen.getAllByTestId('chart')) {
      expect(chart).toHaveAttribute('data-color', hex);
    }
    fireEvent.click(screen.getByRole('button', { name: /Chart colour/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    for (const chart of screen.getAllByTestId('chart')) {
      expect(chart).toHaveAttribute('data-color', '');
    }
  });

  it('recalculates after a refresh picks up new rows', async () => {
    render(<App />);
    await screen.findByText('Ada Park');
    rows.push({ ...seed[0]!, id: 'c', EmployeeID: 3, FullName: 'New Hire', Email: 'n@contoso.com' });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Refresh' })));
    expect(await screen.findByText(/Calculated from 3 records/)).toBeVisible();
  });
});

describe('Data Management', () => {
  it('lists only the ID and name until a record is opened', async () => {
    const item = await openDataManagement();
    expect(item).toHaveTextContent('EMP-0001');
    expect(screen.queryByText('ada@contoso.com')).toBeNull();
    expect(screen.queryByText('120,000.00')).toBeNull();

    fireEvent.click(item);
    const details = screen.getByRole('region', { name: 'Ada Park details' });
    expect(details).toHaveTextContent('ada@contoso.com');
    expect(details).toHaveTextContent('120,000.00');
    // ID plus the four history fields are read-only.
    expect(within(details).getAllByText('Read-only')).toHaveLength(5);
    expect(details).toHaveTextContent('Created byNot recorded');
  });

  it('searches by employee ID or name', async () => {
    await openDataManagement();
    const search = screen.getByLabelText('Search by employee ID or name');
    fireEvent.change(search, { target: { value: 'emp-0002' } });
    expect(screen.queryByRole('button', { name: /Ada Park/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Ravi Shah/ })).toBeVisible();
    fireEvent.change(search, { target: { value: 'ada' } });
    expect(screen.getByRole('button', { name: /Ada Park/ })).toBeVisible();
  });

  it('saves a single field by primary key and shows it only after success', async () => {
    fireEvent.click(await openDataManagement());
    fireEvent.click(screen.getByRole('button', { name: /^Edit Job title/ }));
    const editor = screen.getByRole('form', { name: 'Edit Job title' });
    expect(editor).toHaveTextContent('Current value: Engineer');
    fireEvent.change(within(editor).getByLabelText('Job title'), {
      target: { value: 'Staff Engineer' },
    });
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Save' })));
    expect(updateEmployee).toHaveBeenCalledWith('a', { JobTitle: 'Staff Engineer' });
    expect(await screen.findByRole('button', { name: /^Edit Job title: Staff Engineer/ })).toBeVisible();
  });

  it('keeps the old value and shows the error when a save fails', async () => {
    updateEmployee.mockRejectedValueOnce(new Error('Another employee already uses x.'));
    fireEvent.click(await openDataManagement());
    fireEvent.click(screen.getByRole('button', { name: /^Edit Email/ }));
    const editor = screen.getByRole('form', { name: 'Edit Email' });
    fireEvent.change(within(editor).getByLabelText('Email'), { target: { value: 'x@contoso.com' } });
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Save' })));
    expect(within(editor).getByRole('alert')).toHaveTextContent('already uses');
    fireEvent.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /^Edit Email: ada@contoso.com/ })).toBeVisible();
  });

  it('rejects an invalid value without calling the database', async () => {
    fireEvent.click(await openDataManagement());
    fireEvent.click(screen.getByRole('button', { name: /^Edit Salary/ }));
    const editor = screen.getByRole('form', { name: 'Edit Salary' });
    fireEvent.change(within(editor).getByLabelText('Salary'), { target: { value: '-1' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(within(editor).getByRole('alert')).toBeVisible();
    expect(updateEmployee).not.toHaveBeenCalled();
  });

  it('deletes only after explicit confirmation', async () => {
    fireEvent.click(await openDataManagement());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Record' }));
    expect(deleteEmployee).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Ada Park (EMP-0001)');
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete record' }))
    );
    expect(deleteEmployee).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('region', { name: 'Ada Park details' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ada Park/ })).toBeNull();
  });

  it('keeps the record when the delete fails', async () => {
    deleteEmployee.mockRejectedValueOnce(new Error('Forbidden'));
    fireEvent.click(await openDataManagement());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Record' }));
    const dialog = screen.getByRole('alertdialog');
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete record' }))
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.getByRole('region', { name: 'Ada Park details' })).toBeVisible();
  });
});

describe('Access', () => {
  it('shows an explanation instead of data to someone without a role', async () => {
    session.email = 'stranger@example.com';
    render(<App />);
    expect(await screen.findByRole('heading', { name: /don’t have a role/ })).toBeVisible();
    expect(screen.queryByText('Ada Park')).toBeNull();
    expect(listEmployees).not.toHaveBeenCalled();
  });

  it('gives a Viewer read-only screens and no Admin Console', async () => {
    session.email = 'viewer@contoso.com';
    fireEvent.click(await openDataManagement());
    expect(screen.queryByRole('button', { name: 'Admin Console' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add employee' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Record' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Ada Park details' })).toHaveTextContent('ada@contoso.com');
  });

  it('shows the Admin Console only to roles that include it', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Admin Console' })).toBeVisible();
  });
});
