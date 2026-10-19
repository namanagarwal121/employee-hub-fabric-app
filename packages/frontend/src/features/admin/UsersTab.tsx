//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  ROLE_ASSIGNMENTS,
  ROLES,
  type AccountStatus,
  type AppRole,
  type RoleAssignment,
} from '@rayfin-app/shared';
import { Copy, Info, Plus, Search, Undo2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { useAccess } from '@/features/access/access.context';
import { Modal } from '@/features/employees/Modal';
import { formatDay, formatTimestamp } from '@/features/employees/format';
import { cn } from '@/lib/utils';
import { AUDIT_ACTIONS, auditEventsSince, logAudit } from '@/services/audit.service';

import { DAY, assignmentsSource, lastActivityByEmail } from './admin-data';
import { Button, Callout, Panel, StatusBadge, inputClass, td, th } from './ui';
import { useAsync } from './use-async';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UsersTab() {
  const { email: me } = useAccess();
  const [draft, setDraft] = useState<RoleAssignment[]>(() => [...ROLE_ASSIGNMENTS]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | ''>('');
  const [adding, setAdding] = useState(false);
  const [review, setReview] = useState(false);
  const [activity] = useAsync(() => auditEventsSince(new Date(Date.now() - 90 * DAY)));
  const lastSeen = useMemo(
    () => (activity.status === 'ready' ? lastActivityByEmail(activity.data) : new Map<string, Date>()),
    [activity]
  );

  const changes = useMemo(() => describeChanges(ROLE_ASSIGNMENTS, draft), [draft]);
  const activeAdmins = draft.filter((a) => a.role === 'Admin' && a.status === 'active').length;

  const visible = draft.filter((a) => {
    const term = search.trim().toLowerCase();
    if (term && !a.email.toLowerCase().includes(term) && !a.name.toLowerCase().includes(term)) return false;
    if (roleFilter && a.role !== roleFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  const patch = (email: string, next: Partial<RoleAssignment>) =>
    setDraft((prev) => prev.map((a) => (a.email === email ? { ...a, ...next } : a)));

  return (
    <>
      <Callout tone="info" title="Roles are enforced by the server and change on redeploy">
        This table shows the role list the backend enforces right now. Changes you make here are a draft: review them,
        copy the generated list into <code className="rounded bg-muted px-100">packages/shared/src/access.ts</code>, and
        redeploy. People also need access to the app item in Fabric (Share → Run and interact), which this app cannot
        grant. Sign-in provides only an email, so names are entered here.
      </Callout>

      <Panel
        title="Users and roles"
        description={`${ROLE_ASSIGNMENTS.length} assigned · last activity from the audit log (90 days)`}
        actions={
          <>
            <Button onClick={() => setAdding(true)}>
              <Plus className="icon-size-200" aria-hidden="true" />
              Add user
            </Button>
            <Button variant="primary" disabled={changes.length === 0} onClick={() => setReview(true)}>
              Review {changes.length || ''} change{changes.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-200 border-b border-border p-300">
          <div className="relative min-w-56 flex-1">
            <label htmlFor="user-search" className="sr-only">Search users</label>
            <Search className="pointer-events-none absolute top-1/2 left-300 icon-size-200 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input id="user-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className={cn(inputClass, 'w-full pl-800')} />
          </div>
          <label className="sr-only" htmlFor="user-role-filter">Filter by role</label>
          <select id="user-role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as AppRole | '')} className={inputClass}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="sr-only" htmlFor="user-status-filter">Filter by status</label>
          <select id="user-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AccountStatus | '')} className={inputClass}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {activeAdmins === 0 ? (
          <div className="p-300">
            <Callout tone="danger" title="At least one active Admin is required">
              The draft would leave nobody able to manage roles or read the audit log.
            </Callout>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-300">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>User name</th>
                <th className={th}>Email</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
                <th className={th}>Date added</th>
                <th className={th}>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-400 py-800 text-center text-muted-foreground">No users match these filters.</td>
                </tr>
              ) : (
                visible.map((a) => {
                  const original = ROLE_ASSIGNMENTS.find((o) => o.email === a.email);
                  const changed = !original || original.role !== a.role || original.status !== a.status;
                  const seen = lastSeen.get(a.email.toLowerCase());
                  return (
                    <tr key={a.email} className={cn('border-b border-border last:border-b-0', changed && 'bg-warning/5')}>
                      <td className={`${td} font-medium`}>
                        {a.name}
                        {a.email.toLowerCase() === me.toLowerCase() ? <span className="ml-200 text-200 text-muted-foreground">(you)</span> : null}
                        {changed ? <span className="ml-200 text-200 font-semibold text-warning">{original ? 'Changed' : 'New'}</span> : null}
                      </td>
                      <td className={`${td} text-muted-foreground`}>{a.email}</td>
                      <td className={td}>
                        <label className="sr-only" htmlFor={`role-${a.email}`}>Role for {a.email}</label>
                        <select id={`role-${a.email}`} value={a.role} onChange={(e) => patch(a.email, { role: e.target.value as AppRole })} className={cn(inputClass, 'h-8')}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className={td}>
                        <button
                          type="button"
                          onClick={() => patch(a.email, { status: a.status === 'active' ? 'inactive' : 'active' })}
                          aria-label={`${a.status === 'active' ? 'Deactivate' : 'Activate'} ${a.email}`}
                          className="rounded-full focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <StatusBadge status={a.status === 'active' ? 'healthy' : 'unverified'} label={a.status === 'active' ? 'Active' : 'Inactive'} />
                        </button>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatDay(`${a.addedAt}T00:00:00Z`)}</td>
                      <td className={`${td} whitespace-nowrap text-muted-foreground`}>
                        {activity.status === 'loading' ? '…' : seen ? formatTimestamp(seen) : 'No recorded activity'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {changes.length ? (
          <div className="flex justify-end border-t border-border p-300">
            <Button variant="ghost" onClick={() => setDraft([...ROLE_ASSIGNMENTS])}>
              <Undo2 className="icon-size-200" aria-hidden="true" />
              Discard draft
            </Button>
          </div>
        ) : null}
      </Panel>

      {adding ? (
        <AddUserDialog
          existing={draft}
          onClose={() => setAdding(false)}
          onAdd={(a) => {
            setDraft((prev) => [...prev, a]);
            setAdding(false);
          }}
        />
      ) : null}

      {review ? (
        <ReviewDialog
          changes={changes}
          source={assignmentsSource(draft)}
          blocked={activeAdmins === 0}
          onClose={() => setReview(false)}
        />
      ) : null}
    </>
  );
}

function describeChanges(before: readonly RoleAssignment[], after: readonly RoleAssignment[]): string[] {
  const out: string[] = [];
  for (const a of after) {
    const b = before.find((x) => x.email === a.email);
    if (!b) out.push(`Add ${a.email} as ${a.role}${a.status === 'inactive' ? ' (inactive)' : ''}`);
    else {
      if (b.role !== a.role) out.push(`Change ${a.email} from ${b.role} to ${a.role}`);
      if (b.status !== a.status) out.push(`${a.status === 'active' ? 'Activate' : 'Deactivate'} ${a.email}`);
    }
  }
  return out;
}

function AddUserDialog({
  existing,
  onAdd,
  onClose,
}: {
  readonly existing: readonly RoleAssignment[];
  readonly onAdd: (a: RoleAssignment) => void;
  readonly onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AppRole>('Viewer');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL.test(trimmed)) return setError('Enter the email the person signs in to Microsoft with.');
    if (existing.some((a) => a.email.toLowerCase() === trimmed.toLowerCase())) return setError('That email already has a role.');
    if (!name.trim()) return setError('Enter a name to show in the console.');
    onAdd({ email: trimmed, name: name.trim(), role, status: 'active', addedAt: new Date().toISOString().slice(0, 10) });
  };

  return (
    <Modal title="Add user" description="Adds the person to the draft role list." onClose={onClose} className="max-w-md">
      <form onSubmit={submit} noValidate className="flex flex-col gap-400">
        <label className="flex flex-col gap-100 text-200 font-semibold text-muted-foreground">
          EMAIL
          <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="name@company.com" />
        </label>
        <label className="flex flex-col gap-100 text-200 font-semibold text-muted-foreground">
          NAME
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} />
        </label>
        <label className="flex flex-col gap-100 text-200 font-semibold text-muted-foreground">
          ROLE
          <select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className={inputClass}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {error ? <p role="alert" className="text-200 text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-200">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">Add to draft</Button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewDialog({
  changes,
  source,
  blocked,
  onClose,
}: {
  readonly changes: readonly string[];
  readonly source: string;
  readonly blocked: boolean;
  readonly onClose: () => void;
}) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied('done');
      void logAudit({
        action: AUDIT_ACTIONS.roleChangeDrafted,
        entityType: 'RoleAssignment',
        status: 'success',
        details: changes.join('; '),
      });
    } catch {
      setCopied('failed');
    }
  };
  return (
    <Modal title="Apply role changes" description="These take effect after the next deploy." onClose={onClose}>
      <ul className="mb-400 list-disc space-y-100 pl-500 text-300">
        {changes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      {blocked ? (
        <Callout tone="danger" title="Keep at least one active Admin before applying." />
      ) : (
        <>
          <ol className="mb-300 list-decimal space-y-100 pl-500 text-300 text-muted-foreground">
            <li>Copy the updated list below.</li>
            <li>Replace <code>ROLE_ASSIGNMENTS</code> in <code>packages/shared/src/access.ts</code>.</li>
            <li>Redeploy with <code>npx rayfin up</code>. The server enforces the new roles from then on.</li>
          </ol>
          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted p-300 font-monospace text-200">{source}</pre>
          <div className="mt-400 flex items-center justify-end gap-300">
            {copied === 'done' ? <span role="status" className="text-200 text-success">Copied. The change was recorded in the audit log.</span> : null}
            {copied === 'failed' ? <span role="alert" className="text-200 text-destructive">Copy failed; select the text instead.</span> : null}
            <Button variant="primary" onClick={() => void copy()}>
              <Copy className="icon-size-200" aria-hidden="true" />
              Copy updated list
            </Button>
          </div>
        </>
      )}
      <p className="mt-400 flex items-start gap-200 text-200 text-muted-foreground">
        <Info className="mt-100-nudge icon-size-100 shrink-0" aria-hidden="true" />
        Deactivating someone here removes their data access after deploy; also remove their Fabric access to close the
        app entirely.
      </p>
    </Modal>
  );
}
