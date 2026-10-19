//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { EmployeeRecord } from '@rayfin-app/shared';
import { createContext, useContext } from 'react';

import type { EmployeeInput } from '@/services/employees.service';

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; loadedAt: Date }
  | { kind: 'error'; message: string };

export type Notice = { tone: 'success' | 'error'; text: string };

export interface EmployeesContextValue {
  readonly employees: readonly EmployeeRecord[];
  readonly load: LoadState;
  readonly refreshing: boolean;
  readonly notice: Notice | null;
  /** Re-reads every row from the database. Resolves false on failure. */
  refresh(): Promise<boolean>;
  notify(notice: Notice | null): void;
  /** Each mutation resolves only after the database confirms it, and throws otherwise. */
  create(input: EmployeeInput): Promise<EmployeeRecord>;
  update(id: string, patch: Partial<EmployeeInput>): Promise<EmployeeRecord>;
  remove(id: string): Promise<void>;
}

export const EmployeesContext = createContext<EmployeesContextValue | null>(
  null
);

export function useEmployees(): EmployeesContextValue {
  const value = useContext(EmployeesContext);
  if (!value) throw new Error('useEmployees must be used inside EmployeesProvider.');
  return value;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.replace(/^GraphQL errors:\s*/i, '');
  }
  return 'Something went wrong. Please try again.';
}
