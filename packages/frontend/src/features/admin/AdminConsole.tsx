//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Activity, Database, FileClock, LayoutGrid, UsersRound, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAccess } from '@/features/access/access.context';
import { PageHeader } from '@/features/shell/PageHeader';
import { cn } from '@/lib/utils';

import { AuditLogTab } from './AuditLogTab';
import { DataOperationsTab } from './DataOperationsTab';
import { HealthTab } from './HealthTab';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';

type Tab = 'overview' | 'users' | 'audit' | 'health' | 'data';

const TABS: readonly { id: Tab; label: string; icon: LucideIcon; adminOnly: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, adminOnly: true },
  { id: 'users', label: 'Users', icon: UsersRound, adminOnly: true },
  { id: 'audit', label: 'Audit Logs', icon: FileClock, adminOnly: true },
  { id: 'health', label: 'System Health', icon: Activity, adminOnly: true },
  { id: 'data', label: 'Data Operations', icon: Database, adminOnly: false },
];

function readTab(): Tab | null {
  const id = window.location.hash.replace(/^#admin\/?/, '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : null;
}

/**
 * Admins see every tab. HR Managers see Data Operations only. The server
 * independently refuses audit reads and employee writes to anyone not allowed.
 */
export function AdminConsole() {
  const { can, assignment } = useAccess();
  const isAdmin = can('admin');
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const [tab, setTab] = useState<Tab>(() => {
    const fromHash = readTab();
    return fromHash && tabs.some((t) => t.id === fromHash) ? fromHash : tabs[0]!.id;
  });

  useEffect(() => {
    const onHash = () => {
      const next = readTab();
      if (next && tabs.some((t) => t.id === next)) setTab(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [tabs]);

  const go = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, '', `#admin/${next}`);
  };

  if (!can('importExport')) {
    return (
      <PageHeader
        title="Admin Console"
        description={`Your role (${assignment?.role ?? 'none'}) does not include administrative access.`}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Admin Console"
        description={
          isAdmin
            ? 'Monitor activity, manage access, review the audit trail and run bulk data operations.'
            : 'As an HR Manager you can import and export employee records here.'
        }
      />
      <div role="tablist" aria-label="Admin Console sections" className="-mt-200 flex gap-100 overflow-x-auto border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`admin-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`admin-panel-${id}`}
            onClick={() => go(id)}
            className={cn(
              '-mb-px inline-flex h-11 items-center gap-200 border-b-2 px-400 text-300 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="icon-size-200" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} className="flex flex-col gap-500">
        {tab === 'overview' ? <OverviewTab onOpen={go} /> : null}
        {tab === 'users' ? <UsersTab /> : null}
        {tab === 'audit' ? <AuditLogTab /> : null}
        {tab === 'health' ? <HealthTab /> : null}
        {tab === 'data' ? <DataOperationsTab /> : null}
      </div>
    </>
  );
}
