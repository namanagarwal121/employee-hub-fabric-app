//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Download, FileDown, FileUp, LoaderCircle, Search, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';

import { useEmployees, errorMessage } from '@/features/employees/employees.context';
import { Modal } from '@/features/employees/Modal';
import { formatEmployeeId, toIsoDate } from '@/features/employees/format';
import { cn } from '@/lib/utils';
import { AUDIT_ACTIONS, logAudit } from '@/services/audit.service';
import { deleteEmployee, listEmployees } from '@/services/employees.service';

import { downloadText, parseCsv, toCsv } from './csv';
import { IMPORT_TEMPLATE, MAX_IMPORT_ROWS, REQUIRED_COLUMNS, planImport, type ImportPlan } from './import-plan';
import { rollbackImport, runImport, type ImportResult } from './import-run';
import { Button, Callout, Panel, StatusBadge, inputClass, td, th } from './ui';

export function DataOperationsTab() {
  return (
    <>
      <ExportPanel />
      <ImportPanel />
      <BulkDeletePanel />
    </>
  );
}

// ---------------------------------------------------------------- export

const EXPORT_COLUMNS = [
  'EmployeeID', 'FullName', 'Email', 'Department', 'JobTitle', 'Salary', 'JoiningDate',
  'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy',
] as const;

function ExportPanel() {
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; rows: number } | { kind: 'error'; message: string }>({ kind: 'idle' });

  const exportCsv = async () => {
    setState({ kind: 'busy' });
    try {
      // Read fresh rows so the file matches the database, not a stale screen.
      const rows = await listEmployees();
      const csv = toCsv([
        EXPORT_COLUMNS,
        ...rows.map((e) => [
          e.EmployeeID, e.FullName, e.Email, e.Department, e.JobTitle, e.Salary.toFixed(2), toIsoDate(e.JoiningDate),
          new Date(e.CreatedAt).toISOString(), e.CreatedBy ?? '', e.UpdatedAt ? new Date(e.UpdatedAt).toISOString() : '', e.UpdatedBy ?? '',
        ]),
      ]);
      downloadText(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      void logAudit({ action: AUDIT_ACTIONS.employeeExport, entityType: 'Employee', status: 'success', details: `${rows.length} rows exported` });
      setState({ kind: 'done', rows: rows.length });
    } catch (e) {
      void logAudit({ action: AUDIT_ACTIONS.employeeExport, entityType: 'Employee', status: 'failure', error: e });
      setState({ kind: 'error', message: errorMessage(e) });
    }
  };

  return (
    <Panel
      title="Export employees"
      description="Downloads every employee as CSV, read fresh from the database. The file contains salaries; share it accordingly."
      actions={
        <Button variant="primary" onClick={() => void exportCsv()} disabled={state.kind === 'busy'}>
          {state.kind === 'busy' ? <LoaderCircle className="icon-size-200 animate-spin" aria-hidden="true" /> : <FileDown className="icon-size-200" aria-hidden="true" />}
          {state.kind === 'busy' ? 'Exporting…' : 'Export CSV'}
        </Button>
      }
    >
      {state.kind === 'done' ? <p role="status" className="px-500 py-300 text-300 text-success">Exported {state.rows} employees.</p> : null}
      {state.kind === 'error' ? <p role="alert" className="px-500 py-300 text-300 text-destructive">Export failed: {state.message}</p> : null}
    </Panel>
  );
}

// ---------------------------------------------------------------- import

function ImportPanel() {
  const { employees, refresh } = useEmployees();
  const [file, setFile] = useState<{ name: string; table: string[][] } | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rollback, setRollback] = useState<{ state: 'idle' | 'busy' | 'done'; text?: string }>({ state: 'idle' });
  const [readError, setReadError] = useState<string | null>(null);
  const [planKey, setPlanKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPlan(null);
    setResult(null);
    setRollback({ state: 'idle' });
    setReadError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setResult(null);
    setRollback({ state: 'idle' });
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setReadError('That file is larger than 5 MB.');
      return;
    }
    try {
      const table = parseCsv(await f.text());
      // Validate against freshly read rows, not the cached screen.
      const current = await listEmployees();
      setFile({ name: f.name, table });
      setPlan(planImport(table, current));
      setPlanKey((k) => k + 1);
      setReadError(null);
    } catch (err) {
      setReadError(`The file could not be read: ${errorMessage(err)}`);
    }
  };

  const execute = async () => {
    if (!file || !plan) return;
    setConfirming(false);
    setRunning(true);
    try {
      setResult(await runImport(file.table, plan));
    } catch (e) {
      setResult({ outcomes: [], stoppedAt: null, aborted: `The import could not start: ${errorMessage(e)}. Nothing was written.` });
    } finally {
      setRunning(false);
      void refresh();
    }
  };

  const undo = async () => {
    if (!result) return;
    setRollback({ state: 'busy' });
    const r = await rollbackImport(result.outcomes);
    setRollback({ state: 'done', text: r.failed.length ? `Undid ${r.undone} row(s); ${r.failed.length} could not be undone: ${r.failed.join('; ')}` : `Undid ${r.undone} row(s). The table is back to how it was before the import.` });
    void refresh();
  };

  const writable = plan && plan.fileErrors.length === 0 && plan.counts.error === 0 && plan.counts.create + plan.counts.update > 0;
  const written = result?.outcomes.filter((o) => o.status === 'created' || o.status === 'updated').length ?? 0;

  return (
    <Panel
      title="Import employees from CSV"
      description={`Required columns: ${REQUIRED_COLUMNS.join(', ')}. Optional: EmployeeID (existing ID = update that employee; blank = new employee). Up to ${MAX_IMPORT_ROWS} rows.`}
      actions={
        <Button onClick={() => downloadText('employee-import-template.csv', toCsv(IMPORT_TEMPLATE))}>
          <Download className="icon-size-200" aria-hidden="true" />
          Template
        </Button>
      }
    >
      <div className="flex flex-col gap-400 p-500">
        <div className="flex flex-wrap items-center gap-300">
          <label className={cn(inputClass, 'inline-flex cursor-pointer items-center gap-200 font-semibold hover:bg-accent')}>
            <FileUp className="icon-size-200" aria-hidden="true" />
            Choose CSV file
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e)} className="sr-only" />
          </label>
          {file ? <span className="text-300 text-muted-foreground">{file.name} · {Math.max(0, file.table.length - 1)} rows · checked against {employees.length} existing employees</span> : null}
          {file ? <Button variant="ghost" onClick={reset}>Clear</Button> : null}
        </div>

        {readError ? <Callout tone="danger" title={readError} /> : null}

        {plan && !result ? (
          <>
            {plan.fileErrors.length ? (
              <Callout tone="danger" title="This file can’t be imported">
                <ul className="list-disc pl-500">{plan.fileErrors.map((e) => <li key={e}>{e}</li>)}</ul>
              </Callout>
            ) : (
              <>
                <div className="flex flex-wrap gap-200" aria-live="polite">
                  <StatusBadge status="healthy" label={`${plan.counts.create} new`} />
                  <StatusBadge status="healthy" label={`${plan.counts.update} updates`} />
                  <StatusBadge status="unverified" label={`${plan.counts.unchanged} unchanged`} />
                  <StatusBadge status={plan.counts.error ? 'error' : 'unverified'} label={`${plan.counts.error} with errors`} />
                </div>
                {plan.warnings.map((w) => <Callout key={w} tone="warning" title={w} />)}
                {plan.counts.error ? (
                  <Callout tone="danger" title="Fix the rows with errors and choose the file again">
                    Nothing is written while any row has an error, so valid rows are never imported on their own.
                  </Callout>
                ) : null}
                {/* A new key per file resets the preview's own filter. */}
                <PreviewTable key={planKey} plan={plan} />
                <div className="flex justify-end">
                  <Button variant="primary" disabled={!writable || running} onClick={() => setConfirming(true)}>
                    {running ? <LoaderCircle className="icon-size-200 animate-spin" aria-hidden="true" /> : null}
                    {running ? 'Importing…' : `Import ${plan.counts.create + plan.counts.update} rows`}
                  </Button>
                </div>
              </>
            )}
          </>
        ) : null}

        {result ? <ImportSummary result={result} written={written} rollback={rollback} onUndo={() => void undo()} onDone={reset} /> : null}
      </div>

      {confirming && plan ? (
        <Modal role="alertdialog" title="Import these employees?" onClose={() => setConfirming(false)} className="max-w-md">
          <p className="text-300">
            This will create <strong>{plan.counts.create}</strong> and update <strong>{plan.counts.update}</strong> employee
            record{plan.counts.update === 1 ? '' : 's'} in the live database. Updates replace only the fields that differ.
          </p>
          <p className="mt-300 text-200 text-muted-foreground">
            The data is re-checked just before writing. If a write fails, the import stops and you can undo the rows already written.
          </p>
          <div className="mt-600 flex justify-end gap-300">
            <Button variant="ghost" onClick={() => setConfirming(false)} autoFocus>Cancel</Button>
            <Button variant="primary" onClick={() => void execute()}>Yes, import</Button>
          </div>
        </Modal>
      ) : null}
    </Panel>
  );
}

function PreviewTable({ plan }: { readonly plan: ImportPlan }) {
  const [onlyErrors, setOnlyErrors] = useState(plan.counts.error > 0);
  const rows = onlyErrors ? plan.rows.filter((r) => r.kind === 'error') : plan.rows;
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-400 py-200 text-200">
        <span className="font-semibold">Preview</span>
        <label className="flex items-center gap-200 text-muted-foreground">
          <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
          Show only rows with errors
        </label>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full min-w-[720px] text-300">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              <th className={th}>Line</th>
              <th className={th}>Result</th>
              <th className={th}>Employee</th>
              <th className={th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.line} className={cn('border-b border-border last:border-b-0', r.kind === 'error' && 'bg-destructive/5')}>
                <td className={`${td} tabular-nums text-muted-foreground`}>{r.line}</td>
                <td className={td}>
                  <StatusBadge
                    status={r.kind === 'error' ? 'error' : r.kind === 'unchanged' ? 'unverified' : 'healthy'}
                    label={{ create: 'New', update: 'Update', unchanged: 'Unchanged', error: 'Error' }[r.kind]}
                  />
                </td>
                <td className={td}>
                  {r.kind === 'create' ? `${r.employeeId ? formatEmployeeId(r.employeeId) : 'New ID'} · ${r.value.FullName}` : r.kind === 'error' ? `${r.employeeId ? `${formatEmployeeId(r.employeeId)} · ` : ''}${r.name || '(no name)'}` : `${formatEmployeeId(r.employeeId)} · ${r.target.FullName}`}
                </td>
                <td className={cn(td, r.kind === 'error' && 'text-destructive')}>
                  {r.kind === 'error' ? r.issues.join(' ') : r.kind === 'update' ? `Changes: ${Object.keys(r.changes).join(', ')}` : r.kind === 'unchanged' ? 'Matches the stored record' : 'Will be created'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportSummary({
  result,
  written,
  rollback,
  onUndo,
  onDone,
}: {
  readonly result: ImportResult;
  readonly written: number;
  readonly rollback: { state: 'idle' | 'busy' | 'done'; text?: string };
  readonly onUndo: () => void;
  readonly onDone: () => void;
}) {
  const count = (s: string) => result.outcomes.filter((o) => o.status === s).length;
  if (result.aborted) return <Callout tone="warning" title={result.aborted} />;
  const failed = result.outcomes.filter((o) => o.status === 'failed');
  return (
    <div className="flex flex-col gap-300">
      <Callout
        tone={result.stoppedAt === null ? 'info' : 'danger'}
        title={result.stoppedAt === null ? 'Import complete' : `Import stopped at line ${result.stoppedAt}`}
      >
        {count('created')} created · {count('updated')} updated · {count('unchanged')} unchanged · {count('failed')} failed · {count('not-attempted')} not attempted
      </Callout>
      {failed.length ? (
        <ul className="list-disc pl-500 text-300 text-destructive">
          {failed.map((f) => f.status === 'failed' && <li key={f.line}>Line {f.line}: {f.error}</li>)}
        </ul>
      ) : null}
      {rollback.state === 'done' ? <p role="status" className="text-300">{rollback.text}</p> : null}
      <div className="flex flex-wrap justify-end gap-200">
        {written > 0 && rollback.state !== 'done' ? (
          <Button onClick={onUndo} disabled={rollback.state === 'busy'}>
            <Undo2 className="icon-size-200" aria-hidden="true" />
            {rollback.state === 'busy' ? 'Undoing…' : `Undo ${written} written row${written === 1 ? '' : 's'}`}
          </Button>
        ) : null}
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- bulk delete

function BulkDeletePanel() {
  const { employees, refresh } = useEmployees();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ deleted: number; failed: string[] } | null>(null);

  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t ? employees.filter((e) => e.FullName.toLowerCase().includes(t) || formatEmployeeId(e.EmployeeID).toLowerCase().includes(t)) : employees;
  }, [employees, search]);
  const chosen = employees.filter((e) => selected.has(e.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const phrase = `DELETE ${chosen.length}`;

  const run = async () => {
    setBusy(true);
    const failed: string[] = [];
    let deleted = 0;
    for (const e of chosen) {
      try {
        await deleteEmployee(e.id);
        deleted++;
        void logAudit({ action: AUDIT_ACTIONS.employeeDelete, entityType: 'Employee', recordId: e.id, status: 'success', details: `Bulk delete: ${formatEmployeeId(e.EmployeeID)}` });
      } catch (err) {
        failed.push(`${formatEmployeeId(e.EmployeeID)}: ${errorMessage(err)}`);
        void logAudit({ action: AUDIT_ACTIONS.employeeDelete, entityType: 'Employee', recordId: e.id, status: 'failure', details: `Bulk delete: ${formatEmployeeId(e.EmployeeID)}`, error: err });
      }
    }
    void logAudit({
      action: AUDIT_ACTIONS.employeeBulkDelete,
      entityType: 'Employee',
      status: failed.length ? 'failure' : 'success',
      details: `${deleted} deleted, ${failed.length} failed of ${chosen.length} selected`,
    });
    setSummary({ deleted, failed });
    setSelected(new Set());
    setConfirming(false);
    setTyped('');
    setBusy(false);
    void refresh();
  };

  return (
    <Panel
      title="Bulk delete"
      description="Select employees to delete permanently. Requires typed confirmation."
      actions={
        <Button variant="danger" disabled={chosen.length === 0} onClick={() => { setSummary(null); setConfirming(true); }}>
          <Trash2 className="icon-size-200" aria-hidden="true" />
          Delete {chosen.length || ''} selected
        </Button>
      }
    >
      {summary ? (
        <div className="p-400">
          <Callout tone={summary.failed.length ? 'danger' : 'info'} title={`${summary.deleted} deleted${summary.failed.length ? `, ${summary.failed.length} failed` : ''}`}>
            {summary.failed.length ? <ul className="list-disc pl-500">{summary.failed.map((f) => <li key={f}>{f}</li>)}</ul> : null}
          </Callout>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-300 border-b border-border p-300">
        <div className="relative min-w-56 flex-1">
          <label htmlFor="bulk-search" className="sr-only">Search employees to delete</label>
          <Search className="pointer-events-none absolute top-1/2 left-300 icon-size-200 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input id="bulk-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID or name" className={cn(inputClass, 'w-full pl-800')} />
        </div>
        <span className="text-200 text-muted-foreground">{chosen.length} selected</span>
        {chosen.length ? <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button> : null}
      </div>
      <ul className="max-h-72 divide-y divide-border overflow-y-auto">
        {visible.map((e) => (
          <li key={e.id}>
            <label className="flex cursor-pointer items-center gap-300 px-400 py-200 hover:bg-hover">
              <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Select ${e.FullName}`} />
              <span className="w-20 font-monospace text-200 font-semibold text-muted-foreground">{formatEmployeeId(e.EmployeeID)}</span>
              <span className="text-300">{e.FullName}</span>
            </label>
          </li>
        ))}
      </ul>

      {confirming ? (
        <Modal role="alertdialog" title={`Delete ${chosen.length} employee${chosen.length === 1 ? '' : 's'}?`} onClose={() => !busy && setConfirming(false)} className="max-w-md">
          <p className="text-300">These records will be permanently removed from the Employees table:</p>
          <ul className="my-300 max-h-40 list-disc overflow-y-auto pl-500 text-300">
            {chosen.map((e) => <li key={e.id}>{e.FullName} ({formatEmployeeId(e.EmployeeID)})</li>)}
          </ul>
          <label className="flex flex-col gap-100 text-200 text-muted-foreground">
            Type <strong className="font-monospace text-foreground">{phrase}</strong> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus className={inputClass} disabled={busy} />
          </label>
          <div className="mt-600 flex justify-end gap-300">
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" disabled={typed !== phrase || busy} onClick={() => void run()}>
              {busy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </Panel>
  );
}
