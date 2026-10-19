//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { EMPLOYEE_LIMITS } from '@rayfin-app/shared';
import { LoaderCircle } from 'lucide-react';
import {
  useId,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';
import {
  validateEmployee,
  type EmployeeFormErrors,
  type EmployeeFormValues,
  type EmployeeInput,
} from '@/services/employees.service';

interface EmployeeFormProps {
  readonly initial: EmployeeFormValues;
  readonly departments: readonly string[];
  readonly submitLabel: string;
  /** Resolves with an error message to keep the form open, or null on success. */
  readonly onSubmit: (value: EmployeeInput) => Promise<string | null>;
  readonly onCancel: () => void;
}

export function EmployeeForm({
  initial,
  departments,
  submitLabel,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const id = useId();

  const set = (key: keyof EmployeeFormValues) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateEmployee(values);
    if (result.errors) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const failure = await onSubmit(result.value);
    setSaving(false);
    if (failure) setSaveError(failure);
  };

  const field = (
    key: keyof EmployeeFormValues,
    label: string,
    props: InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div className="flex flex-col gap-100">
      <label
        htmlFor={`${id}-${key}`}
        className="text-200 font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        name={key}
        value={values[key]}
        onChange={(e) => set(key)(e.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        disabled={saving}
        className={cn(
          'h-10 rounded-lg border border-input bg-background px-300 text-300 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60',
          errors[key] && 'border-destructive focus-visible:ring-destructive/30'
        )}
        {...props}
      />
      {errors[key] ? (
        <p id={`${id}-${key}-error`} className="text-200 text-destructive">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-500">
      <div className="grid gap-400 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {field('FullName', 'Full name', {
            maxLength: EMPLOYEE_LIMITS.FullName,
            autoComplete: 'off',
            autoFocus: true,
          })}
        </div>
        <div className="sm:col-span-2">
          {field('Email', 'Email', {
            type: 'email',
            maxLength: EMPLOYEE_LIMITS.Email,
            autoComplete: 'off',
            placeholder: 'name@company.com',
          })}
        </div>
        {field('Department', 'Department', {
          maxLength: EMPLOYEE_LIMITS.Department,
          list: `${id}-departments`,
          autoComplete: 'off',
        })}
        <datalist id={`${id}-departments`}>
          {departments.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        {field('JobTitle', 'Job title', {
          maxLength: EMPLOYEE_LIMITS.JobTitle,
          autoComplete: 'off',
        })}
        {field('Salary', 'Salary', {
          inputMode: 'decimal',
          placeholder: '0.00',
        })}
        {field('JoiningDate', 'Joining date', { type: 'date' })}
      </div>

      {saveError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-400 py-300 text-300 text-destructive"
        >
          {saveError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-300 border-t border-border pt-500">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-10 rounded-full px-500 text-300 font-semibold text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-200 rounded-full bg-primary px-500 text-300 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {saving ? (
            <LoaderCircle className="icon-size-200 animate-spin" aria-hidden="true" />
          ) : null}
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
