//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ROLE_ASSIGNMENTS } from '@rayfin-app/shared';
import { CircleAlert, FilePlus2, FilePen, UserRoundCheck, Users } from 'lucide-react';
import { useState } from 'react';

import { useEmployees } from '@/features/employees/employees.context';
import { formatTimestamp } from '@/features/employees/format';
import { RefreshButton } from '@/features/shell/PageHeader';
import { auditEventsSince } from '@/services/audit.service';

import { DAY, actionLabel, listAppUsers } from './admin-data';
import { Button, Callout, LoadingRows, OutcomeBadge, Panel, StatCard, td, th } from './ui';
import { useAsync } from './use-async';

const WINDOW_DAYS = 7;

export function OverviewTab({ onOpen }: { readonly onOpen: (tab: 'audit' | 'users') => void }) {
  const { employees, load, refresh, refreshing } = useEmployees();
  const [since] = useState(() => new Date(Date.now() - WINDOW_DAYS * DAY));
  const [audit, reloadAudit] = useAsync(() => auditEventsSince(since));
  const [users, reloadUsers] = useAsync(listAppUsers);

  const created = employees.filter((e) => new Date(e.CreatedAt) >= since).length;
  const updated = employees.filter((e) => e.UpdatedAt && new Date(e.UpdatedAt) >= since).length;
  const activeAssignments = ROLE_ASSIGNMENTS.filter((a) => a.status === 'active').length;
  const failures = audit.status === 'ready' ? audit.data.filter((e) => e.Status === 'failure').length : null;

  const reloadAll = () => {
    void refresh();
    void reloadAudit();
    void reloadUsers();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-300">
        <p className="text-200 text-muted-foreground">
          Employee figures from the Employees table
          {load.kind === 'ready' ? `, loaded ${formatTimestamp(load.loadedAt)}` : ''}. Activity covers the last {WINDOW_DAYS} days.
        </p>
        <RefreshButton refreshing={refreshing || audit.status === 'loading'} onClick={reloadAll} />
      </div>

      <section aria-label="Admin key figures" className="grid gap-400 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} label="Total employees" value={load.kind === 'ready' ? employees.length : '—'} />
        <StatCard
          icon={UserRoundCheck}
          label="App users"
          value={activeAssignments}
          hint={
            users.status === 'ready'
              ? `${users.data.length} have created or edited records`
              : users.status === 'error'
                ? 'Edit history unavailable'
                : 'Loading edit history…'
          }
        />
        <StatCard icon={FilePlus2} label="Records created" value={load.kind === 'ready' ? created : '—'} hint={`Last ${WINDOW_DAYS} days`} />
        <StatCard icon={FilePen} label="Records updated" value={load.kind === 'ready' ? updated : '—'} hint={`Last ${WINDOW_DAYS} days`} />
        <StatCard
          icon={CircleAlert}
          label="Failed operations"
          value={failures ?? '—'}
          tone={failures ? 'danger' : 'neutral'}
          hint={audit.status === 'error' ? 'Audit log unavailable' : `Last ${WINDOW_DAYS} days, from the audit log`}
        />
      </section>

      <Panel
        title="Recent activity"
        description="The latest events from the audit log."
        actions={<Button onClick={() => onOpen('audit')}>Open audit logs</Button>}
      >
        {audit.status === 'loading' ? (
          <LoadingRows rows={4} />
        ) : audit.status === 'error' ? (
          <div className="p-400">
            <Callout tone="danger" title="The audit log could not be read">
              {audit.error}
            </Callout>
          </div>
        ) : audit.data.length === 0 ? (
          <p className="px-500 py-800 text-center text-300 text-muted-foreground">No activity in the last {WINDOW_DAYS} days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-300">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>When</th>
                  <th className={th}>User</th>
                  <th className={th}>Action</th>
                  <th className={th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.slice(0, 8).map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-b-0">
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{formatTimestamp(e.OccurredAt)}</td>
                    <td className={`${td} text-muted-foreground`}>{e.UserEmail}</td>
                    <td className={td}>{actionLabel(e.Action)}</td>
                    <td className={td}>
                      <OutcomeBadge status={e.Status} />
                    </td>
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
