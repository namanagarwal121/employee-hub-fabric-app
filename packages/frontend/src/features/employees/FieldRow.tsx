//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { EMPLOYEE_LIMITS } from '@rayfin-app/shared';
import { LoaderCircle, Lock, Pencil } from 'lucide-react';
import { useId, useState, type FormEvent, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';
import {
  FIELD_LABELS,
  validateField,
  type EditableField,
  type EmployeeInput,
} from '@/services/employees.service';

/** A field that cannot be edited, such as the ID or creation time. */
export function ReadOnlyRow({
  label,
  value,
  reason,
}: {
  readonly label: string;
  readonly value: string;
  readonly reason: string;
}) {
  return (
    <div className="flex items-center gap-300 rounded-lg px-300 py-300">
      <div className="min-w-0 flex-1">
        <dt className="text-200 font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-100-nudge truncate text-300 font-medium">{value}</dd>
      </div>
      <span
        title={reason}
        className="inline-flex items-center gap-100 rounded-md bg-muted px-200 py-100 text-200 text-muted-foreground"
      >
        <Lock className="icon-size-100" aria-hidden="true" />
        Read-only
      </span>
    </div>
  );
}

const INPUT_PROPS: Record<EditableField, InputHTMLAttributes<HTMLInputElement>> = {
  FullName: { type: 'text', maxLength: EMPLOYEE_LIMITS.FullName },
  Email: { type: 'email', maxLength: EMPLOYEE_LIMITS.Email },
  Department: { type: 'text', maxLength: EMPLOYEE_LIMITS.Department },
  JobTitle: { type: 'text', maxLength: EMPLOYEE_LIMITS.JobTitle },
  Salary: { type: 'number', min: 0, step: '0.01', inputMode: 'decimal' },
  JoiningDate: { type: 'date' },
};

/**
 * One editable field. Clicking it opens an inline editor showing the field
 * name, the current value, a typed input, and Save / Cancel. The shown value
 * changes only after `onSave` resolves, which is after the database confirms.
 */
export function EditableRow<K extends EditableField>({
  field,
  display,
  rawValue,
  editing,
  disabled,
  suggestions,
  onEdit,
  onCancel,
  onSave,
}: {
  readonly field: K;
  /** The formatted value shown in the details panel. */
  readonly display: string;
  /** The value the input starts with. */
  readonly rawValue: string;
  readonly editing: boolean;
  readonly disabled: boolean;
  readonly suggestions?: readonly string[];
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  /** Resolves with an error message to keep the editor open, or null on success. */
  readonly onSave: (value: EmployeeInput[K]) => Promise<string | null>;
}) {
  const label = FIELD_LABELS[field];

  if (!editing) {
    return (
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        aria-label={`Edit ${label}: ${display}`}
        className="group flex w-full items-center gap-300 rounded-lg px-300 py-300 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <dt className="text-200 font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-100-nudge truncate text-300 font-medium">{display}</dd>
        </div>
        <Pencil
          className="icon-size-200 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <FieldEditor
      field={field}
      display={display}
      rawValue={rawValue}
      suggestions={suggestions}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

function FieldEditor<K extends EditableField>({
  field,
  display,
  rawValue,
  suggestions,
  onCancel,
  onSave,
}: {
  readonly field: K;
  readonly display: string;
  readonly rawValue: string;
  readonly suggestions?: readonly string[];
  readonly onCancel: () => void;
  readonly onSave: (value: EmployeeInput[K]) => Promise<string | null>;
}) {
  const [value, setValue] = useState(rawValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const label = FIELD_LABELS[field];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateField(field, value);
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onSave(result.value);
    // On success the parent closes the editor and this component unmounts.
    if (failure) {
      setSaving(false);
      setError(failure);
    }
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !saving) {
          e.stopPropagation();
          onCancel();
        }
      }}
      noValidate
      aria-label={`Edit ${label}`}
      className="flex flex-col gap-300 rounded-lg border border-primary/40 bg-primary/5 p-400"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-200">
        <label htmlFor={`${id}-input`} className="text-300 font-semibold">
          {label}
        </label>
        <span className="truncate text-200 text-muted-foreground">
          Current value: <span className="font-medium text-foreground">{display}</span>
        </span>
      </div>
      <input
        id={`${id}-input`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        autoFocus
        disabled={saving}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        list={suggestions ? `${id}-list` : undefined}
        autoComplete="off"
        className={cn(
          'h-10 rounded-lg border border-input bg-card px-300 text-300 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60',
          error && 'border-destructive focus-visible:ring-destructive/30'
        )}
        {...INPUT_PROPS[field]}
      />
      {suggestions ? (
        <datalist id={`${id}-list`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-200 text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-9 rounded-lg px-400 text-300 font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center gap-200 rounded-lg bg-primary px-400 text-300 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="icon-size-200 animate-spin" aria-hidden="true" /> : null}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
