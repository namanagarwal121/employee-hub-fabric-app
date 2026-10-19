//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { AuditEventRecord } from '@rayfin-app/shared';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { useAccess } from '@/features/access/access.context';
import { useEmployees } from '@/features/employees/employees.context';
import { formatTimestamp } from '@/features/employees/format';
import { getRayfinClient } from '@/lib/rayfin-client';
import { cn } from '@/lib/utils';
import { auditEventsSince } from '@/services/audit.service';

import { DAY, actionLabel } from './admin-data';
import { Button, Panel, StatusBadge, td, th, type HealthStatus } from './ui';

const SLOW_MS = 2000;

interface Check {
  status: HealthStatus;
  summary: string;
  detail?: string;
  at?: Date;
}

const checking: Check = { status: 'checking', summary: 'Running check…' };

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await fn();
  return { ms: Math.round(performance.now() - start), value };
}

function apiCheck(label: string, fn: () => Promise<unknown>): Promise<Check> {
  return timed(fn).then(
    ({ ms }) => ({
      status: ms > SLOW_MS ? 'warning' : 'healthy',
      summary: ms > SLOW_MS ? `${label} responded slowly (${ms} ms)` : `${label} responded in ${ms} ms`,
      at: new Date(),
    }),
    (e: unknown) => ({
      status: 'error',
      summary: `${label} request failed`,
      detail: e instanceof Error ? e.message.replace(/^GraphQL errors:\s*/i, '') : String(e),
      at: new Date(),
    })
  );
}

export function HealthTab() {
  const { load } = useEmployees();
  const { assignment } = useAccess();
  const [data, setData] = useState<Check>(checking);
  const [audit, setAudit] = useState<Check>(checking);
  const [session, setSession] = useState<Check>(checking);
  const [events, setEvents] = useState<AuditEventRecord[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setData(checking);
    setAudit(checking);
    setSession(checking);
    const client = await getRayfinClient();
    const s = client.auth.getSession();
    setSession(
      s.isAuthenticated && s.user?.email
        ? {
            status: 'healthy',
            summary: `Signed in as ${s.user.email}`,
            detail: s.expiresAt ? `Token expires ${formatTimestamp(s.expiresAt)}` : undefined,
            at: new Date(),
          }
        : { status: 'error', summary: 'No authenticated session', at: new Date() }
    );
    const [d, a] = await Promise.all([
      apiCheck('Employees data API', () => client.data.Employee.select(['id']).first(1).execute()),
      apiCheck('Audit log API', () => client.data.AuditEvent.select(['id']).first(1).execute()),
    ]);
    setData(d);
    setAudit(a);
    try {
      setEvents(await auditEventsSince(new Date(Date.now() - 7 * DAY)));
      setEventsError(null);
    } catch (e) {
      setEvents(null);
      setEventsError(e instanceof Error ? e.message : 'Audit log unavailable');
    }
    setCheckedAt(new Date());
    setRunning(false);
  }, []);

  useEffect(() => {
    // Run every check once when the page opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run]);

  const day = (checkedAt?.getTime() ?? 0) - DAY;
  const failures24h = events?.filter((e) => e.Status === 'failure' && new Date(e.OccurredAt).getTime() >= day) ?? null;
  const imports = events?.filter((e) => e.Action === 'employee.import') ?? null;
  const lastImport = imports?.find((e) => e.Status === 'success') ?? null;
  const importFailures = imports?.filter((e) => e.Status === 'failure') ?? null;
  const eventCheck = (fn: () => Check): Check =>
    eventsError ? { status: 'unverified', summary: 'Could not read the audit log', detail: eventsError } : events === null ? checking : fn();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-300">
        <p className="text-200 text-muted-foreground">
          {checkedAt ? `Last checked ${formatTimestamp(checkedAt)}.` : 'Checking…'} Only components that were actually
          checked are marked as verified.
        </p>
        <Button onClick={() => void run()} disabled={running}>
          <RefreshCw className={cn('icon-size-200', running && 'animate-spin')} aria-hidden="true" />
          {running ? 'Checking…' : 'Run checks'}
        </Button>
      </div>

      <div className="grid gap-400 md:grid-cols-2 xl:grid-cols-3">
        <HealthCard title="Backend data API" check={data} />
        <HealthCard title="Audit log API" check={audit} />
        <HealthCard title="Sign-in session" check={session} />
        <HealthCard
          title="Role assignment"
          check={
            assignment
              ? { status: 'healthy', summary: `${assignment.role} (${assignment.status})`, detail: 'Read from the deployed role list.' }
              : { status: 'error', summary: 'No role assigned' }
          }
        />
        <HealthCard
          title="Last data refresh"
          check={
            load.kind === 'ready'
              ? { status: 'healthy', summary: `Employees loaded ${formatTimestamp(load.loadedAt)}`, at: load.loadedAt }
              : load.kind === 'error'
                ? { status: 'error', summary: 'The last load failed', detail: load.message }
                : checking
          }
        />
        <HealthCard
          title="Last CSV import"
          check={eventCheck(() =>
            lastImport
              ? { status: 'healthy', summary: `Succeeded ${formatTimestamp(lastImport.OccurredAt)}`, detail: lastImport.Details ?? undefined }
              : { status: 'unverified', summary: 'No successful import in the last 7 days' }
          )}
        />
        <HealthCard
          title="Failed operations (24 h)"
          check={eventCheck(() =>
            failures24h!.length
              ? { status: 'warning', summary: `${failures24h!.length} failed operation${failures24h!.length === 1 ? '' : 's'}`, detail: 'See the list below.' }
              : { status: 'healthy', summary: 'No failures recorded' }
          )}
        />
        <HealthCard
          title="CSV import failures (7 days)"
          check={eventCheck(() =>
            importFailures!.length
              ? { status: 'warning', summary: `${importFailures!.length} import${importFailures!.length === 1 ? '' : 's'} failed` }
              : { status: 'healthy', summary: 'No import failures recorded' }
          )}
        />
        <HealthCard
          title="Server functions"
          check={{ status: 'info', summary: 'This app does not use server functions, so there is nothing to check.' }}
        />
      </div>

      <Panel title="Recent failed operations" description="Failures recorded in the audit log over the last 7 days.">
        {eventsError ? (
          <p className="p-400 text-300 text-destructive">{eventsError}</p>
        ) : events === null ? (
          <p className="p-400 text-300 text-muted-foreground">Loading…</p>
        ) : events.filter((e) => e.Status === 'failure').length === 0 ? (
          <p className="px-500 py-600 text-center text-300 text-muted-foreground">No failed operations recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-300">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>When</th>
                  <th className={th}>User</th>
                  <th className={th}>Action</th>
                  <th className={th}>Error</th>
                </tr>
              </thead>
              <tbody>
                {events
                  .filter((e) => e.Status === 'failure')
                  .slice(0, 20)
                  .map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-b-0">
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{formatTimestamp(e.OccurredAt)}</td>
                      <td className={`${td} text-muted-foreground`}>{e.UserEmail}</td>
                      <td className={td}>{actionLabel(e.Action)}</td>
                      <td className={`${td} text-destructive`}>{e.ErrorDetails ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function HealthCard({ title, check }: { readonly title: string; readonly check: Check }) {
  const body: ReactNode = (
    <>
      <p className="text-300">{check.summary}</p>
      {check.detail ? <p className="text-200 break-words text-muted-foreground">{check.detail}</p> : null}
      {check.at ? <p className="text-200 text-muted-foreground">Checked {formatTimestamp(check.at)}</p> : null}
    </>
  );
  return (
    <section aria-label={title} className="flex flex-col gap-200 rounded-xl border border-border bg-card p-500">
      <div className="flex items-start justify-between gap-300">
        <h3 className="text-300 font-semibold">{title}</h3>
        <StatusBadge status={check.status} />
      </div>
      {body}
    </section>
  );
}
