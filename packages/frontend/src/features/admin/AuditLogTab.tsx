//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ROLE_ASSIGNMENTS, type AuditEventRecord } from '@rayfin-app/shared';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Modal } from '@/features/employees/Modal';
import { formatTimestamp } from '@/features/employees/format';
import { cn } from '@/lib/utils';
import { AUDIT_ACTIONS, listAuditEvents, type AuditFilters } from '@/services/audit.service';

import { actionLabel } from './admin-data';
import { Button, Callout, LoadingRows, OutcomeBadge, Panel, inputClass, td, th } from './ui';
import { useAsync } from './use-async';

const PAGE_SIZE = 25;

interface FilterForm {
  from: string;
  to: string;
  user: string;
  action: string;
  status: '' | 'success' | 'failure';
}

const EMPTY: FilterForm = { from: '', to: '', user: '', action: '', status: '' };

function toFilters(f: FilterForm): AuditFilters {
  return {
    from: f.from ? new Date(`${f.from}T00:00:00`) : null,
    // Inclusive of the whole "to" day in local time.
    to: f.to ? new Date(`${f.to}T23:59:59.999`) : null,
    userEmail: f.user || null,
    action: f.action || null,
    status: f.status || null,
  };
}

export function AuditLogTab() {
  const [form, setForm] = useState<FilterForm>(EMPTY);
  const [applied, setApplied] = useState<FilterForm>(EMPTY);
  // Cursor for each page visited, so Previous can go back (the API pages forward only).
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<AuditEventRecord | null>(null);
  const page = cursors.length - 1;
  const [state, reload] = useAsync(
    () => listAuditEvents(toFilters(applied), PAGE_SIZE, cursors[page]),
    [applied, page]
  );

  const apply = (e?: FormEvent) => {
    e?.preventDefault();
    if (form.from && form.to && form.from > form.to) return;
    setApplied(form);
    setCursors([null]);
  };
  const clear = () => {
    setForm(EMPTY);
    setApplied(EMPTY);
    setCursors([null]);
  };
  const filtersActive = Object.values(applied).some(Boolean);
  const rangeInvalid = Boolean(form.from && form.to && form.from > form.to);

  return (
    <>
      <Panel title="Filters">
        <form onSubmit={apply} className="grid gap-300 p-400 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <label className="flex flex-col gap-100 text-200 font-medium text-muted-foreground">
            From
            <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-100 text-200 font-medium text-muted-foreground">
            To
            <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} aria-invalid={rangeInvalid || undefined} className={inputClass} />
          </label>
          <label className="flex flex-col gap-100 text-200 font-medium text-muted-foreground">
            User
            <input
              list="audit-users"
              value={form.user}
              onChange={(e) => setForm({ ...form, user: e.target.value.trim() })}
              placeholder="Any user"
              className={inputClass}
            />
            <datalist id="audit-users">
              {ROLE_ASSIGNMENTS.map((a) => <option key={a.email} value={a.email} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-100 text-200 font-medium text-muted-foreground">
            Action
            <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className={inputClass}>
              <option value="">Any action</option>
              {Object.values(AUDIT_ACTIONS).map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-100 text-200 font-medium text-muted-foreground">
            Status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FilterForm['status'] })} className={inputClass}>
              <option value="">Any status</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </label>
          <div className="flex items-end gap-200">
            <Button variant="primary" type="submit" disabled={rangeInvalid}>
              <Filter className="icon-size-200" aria-hidden="true" />
              Apply
            </Button>
            {filtersActive ? (
              <Button variant="ghost" onClick={clear} aria-label="Clear filters">
                <X className="icon-size-200" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          {rangeInvalid ? <p role="alert" className="text-200 text-destructive sm:col-span-2">The “From” date must be on or before the “To” date.</p> : null}
        </form>
      </Panel>

      <Panel
        title="Audit log"
        description="Append-only. Events are written under the signed-in user’s own email and cannot be edited or deleted through the app."
        actions={<Button onClick={() => void reload()}>Refresh</Button>}
      >
        {state.status === 'loading' ? (
          <LoadingRows rows={8} />
        ) : state.status === 'error' ? (
          <div className="p-400">
            <Callout tone="danger" title="The audit log could not be read">{state.error}</Callout>
          </div>
        ) : state.data.items.length === 0 ? (
          <p className="px-500 py-800 text-center text-300 text-muted-foreground">
            {filtersActive ? 'No events match these filters.' : 'No events recorded yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-300">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>Timestamp</th>
                  <th className={th}>User</th>
                  <th className={th}>Action</th>
                  <th className={th}>Entity</th>
                  <th className={th}>Record ID</th>
                  <th className={th}>Result</th>
                  <th className={th}>Error</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((e) => (
                  <tr
                    key={e.id}
                    tabIndex={0}
                    onClick={() => setSelected(e)}
                    onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && (k.preventDefault(), setSelected(e))}
                    aria-label={`Open event ${actionLabel(e.Action)} at ${formatTimestamp(e.OccurredAt)}`}
                    className="cursor-pointer border-b border-border last:border-b-0 hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{formatTimestamp(e.OccurredAt)}</td>
                    <td className={`${td} text-muted-foreground`}>{e.UserEmail}</td>
                    <td className={`${td} whitespace-nowrap`}>{actionLabel(e.Action)}</td>
                    <td className={td}>{e.EntityType}</td>
                    <td className={`${td} font-monospace text-200 text-muted-foreground`}>{e.RecordId ? `${e.RecordId.slice(0, 8)}…` : '—'}</td>
                    <td className={td}><OutcomeBadge status={e.Status} /></td>
                    <td className={cn(td, 'max-w-64 truncate text-destructive')}>{e.ErrorDetails ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-300 border-t border-border px-400 py-300 text-200 text-muted-foreground">
          <span>Page {page + 1} · {PAGE_SIZE} per page</span>
          <div className="flex gap-200">
            <Button disabled={page === 0 || state.status === 'loading'} onClick={() => setCursors((c) => c.slice(0, -1))}>
              <ChevronLeft className="icon-size-200" aria-hidden="true" />
              Previous
            </Button>
            <Button
              disabled={state.status !== 'ready' || !state.data.hasNextPage}
              onClick={() => state.status === 'ready' && setCursors((c) => [...c, state.data.endCursor])}
            >
              Next
              <ChevronRight className="icon-size-200" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Panel>

      {selected ? (
        <Modal title="Audit event" description={formatTimestamp(selected.OccurredAt)} onClose={() => setSelected(null)}>
          <dl className="grid gap-x-500 gap-y-300 text-300 sm:grid-cols-[max-content_1fr]">
            {(
              [
                ['Timestamp', new Date(selected.OccurredAt).toISOString()],
                ['User', selected.UserEmail],
                ['Action', `${actionLabel(selected.Action)} (${selected.Action})`],
                ['Entity', selected.EntityType],
                ['Record ID', selected.RecordId ?? '—'],
                ['Result', selected.Status === 'success' ? 'Success' : 'Failure'],
                ['Details', selected.Details ?? '—'],
                ['Error details', selected.ErrorDetails ?? '—'],
                ['Event ID', selected.id],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium text-muted-foreground">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      ) : null}
    </>
  );
}
