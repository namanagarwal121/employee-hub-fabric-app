//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { AUDIT_ACTIONS, logAudit } from '@/services/audit.service';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
  type EmployeeInput,
} from '@/services/employees.service';

import {
  EmployeesContext,
  errorMessage,
  type EmployeesContextValue,
  type LoadState,
  type Notice,
} from './employees.context';
import { formatEmployeeId } from './format';

function definedFields<T extends object>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row ?? {}).filter(([, v]) => v !== undefined && v !== null)
  ) as Partial<T>;
}

const byEmployeeId = (a: EmployeeRecord, b: EmployeeRecord) =>
  a.EmployeeID - b.EmployeeID;

/**
 * Holds the one copy of the Employees table both sections read, so switching
 * sections never refetches or drops the connection. Local state changes only
 * after the database confirms a write; nothing is applied optimistically.
 */
export function EmployeesProvider({ children }: { readonly children: ReactNode }) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const employeesRef = useRef(employees);
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await listEmployees();
      setEmployees(rows);
      setLoad({ kind: 'ready', loadedAt: new Date() });
      return true;
    } catch (error) {
      const message = errorMessage(error);
      setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'error', message }));
      setNotice({ tone: 'error', text: `Could not load employees. ${message}` });
      return false;
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount; `refresh` is stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Success notices fade on their own; errors stay until dismissed.
  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const create = useCallback(
    async (input: EmployeeInput) => {
      let saved: EmployeeRecord;
      try {
        saved = await createEmployee(input);
      } catch (error) {
        void logAudit({
          action: AUDIT_ACTIONS.employeeCreate,
          entityType: 'Employee',
          status: 'failure',
          error,
        });
        throw error;
      }
      void logAudit({
        action: AUDIT_ACTIONS.employeeCreate,
        entityType: 'Employee',
        recordId: saved.id,
        status: 'success',
        details: `Created ${formatEmployeeId(saved.EmployeeID)}`,
      });
      setEmployees((prev) => [...prev, saved].sort(byEmployeeId));
      // Re-read so rows added elsewhere since the last load also appear.
      void refresh();
      return saved;
    },
    [refresh]
  );

  const update = useCallback(
    async (id: string, patch: Partial<EmployeeInput>) => {
      // Field names only: values such as salaries stay out of the log.
      const fields = Object.keys(patch).join(', ');
      let saved: EmployeeRecord;
      try {
        saved = await updateEmployee(id, patch);
      } catch (error) {
        void logAudit({
          action: AUDIT_ACTIONS.employeeUpdate,
          entityType: 'Employee',
          recordId: id,
          status: 'failure',
          details: `Fields: ${fields}`,
          error,
        });
        throw error;
      }
      void logAudit({
        action: AUDIT_ACTIONS.employeeUpdate,
        entityType: 'Employee',
        recordId: id,
        status: 'success',
        details: `Fields: ${fields}`,
      });
      // The update response may carry only the changed columns, so merge the
      // confirmed values into the row we already hold instead of replacing it.
      let merged: EmployeeRecord | undefined;
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          merged = { ...e, ...patch, ...definedFields(saved) };
          return merged;
        })
      );
      return merged ?? { ...(saved as EmployeeRecord) };
    },
    []
  );

  const remove = useCallback(
    async (id: string) => {
      const label = employeesRef.current.find((e) => e.id === id);
      const details = label ? `Deleted ${formatEmployeeId(label.EmployeeID)}` : undefined;
      try {
        await deleteEmployee(id);
      } catch (error) {
        void logAudit({
          action: AUDIT_ACTIONS.employeeDelete,
          entityType: 'Employee',
          recordId: id,
          status: 'failure',
          details,
          error,
        });
        throw error;
      }
      void logAudit({
        action: AUDIT_ACTIONS.employeeDelete,
        entityType: 'Employee',
        recordId: id,
        status: 'success',
        details,
      });
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      void refresh();
    },
    [refresh]
  );

  const value = useMemo<EmployeesContextValue>(
    () => ({
      employees,
      load,
      refreshing,
      notice,
      refresh,
      notify: setNotice,
      create,
      update,
      remove,
    }),
    [employees, load, refreshing, notice, refresh, create, update, remove]
  );

  return <EmployeesContext.Provider value={value}>{children}</EmployeesContext.Provider>;
}
