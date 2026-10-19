//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  CircleAlert,
  CircleCheck,
  LayoutDashboard,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sun,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useAccess } from '@/features/access/access.context';
import { useEmployees, type Notice } from '@/features/employees/employees.context';
import { useTheme } from '@/hooks/theme.context';
import { cn } from '@/lib/utils';

import type { Section } from './use-section';

const NAV: readonly { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'data', label: 'Data Management', icon: Users },
  { id: 'admin', label: 'Admin Console', icon: ShieldCheck },
];

const COLLAPSE_KEY = 'employee-hub.sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell({
  section,
  onNavigate,
  children,
}: {
  readonly section: Section;
  readonly onNavigate: (next: Section) => void;
  readonly children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { isDark, toggleTheme } = useTheme();
  const { notice, notify } = useEmployees();
  const { email, assignment, can } = useAccess();
  // Admins see the whole console; HR Managers see its Data Operations tab.
  const nav = NAV.filter((item) => item.id !== 'admin' || can('importExport'));

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      // The preference simply isn't remembered.
    }
  };

  return (
    <div className="flex h-full bg-background">
      <aside
        aria-label="Primary"
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          // Below md the sidebar is always an icon rail.
          'w-16',
          !collapsed && 'md:w-60'
        )}
      >
        <div className="flex h-16 items-center gap-300 border-b border-border px-400">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-300 font-bold text-primary-foreground"
          >
            EH
          </span>
          <span
            className={cn(
              'truncate text-400 font-semibold tracking-tight',
              'hidden',
              !collapsed && 'md:inline'
            )}
          >
            Employee Hub
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-100 p-300">
          {nav.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                title={label}
                className={cn(
                  'group relative flex h-10 items-center gap-300 rounded-lg px-300 text-300 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-200 bottom-200 -left-300 w-1 rounded-r-full bg-primary"
                  />
                ) : null}
                <Icon className="icon-size-300 shrink-0" aria-hidden="true" />
                <span className={cn('truncate', 'sr-only', !collapsed && 'md:not-sr-only')}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col gap-100 border-t border-border p-300">
          <div
            title={`${email} · ${assignment?.role ?? ''}`}
            className={cn('mb-100 min-w-0 rounded-lg bg-muted px-300 py-200', 'hidden', !collapsed && 'md:block')}
          >
            <p className="truncate text-200 font-medium">{assignment?.name ?? email}</p>
            <p className="text-200 text-muted-foreground">{assignment?.role}</p>
          </div>
          <SidebarButton
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Light mode' : 'Dark mode'}
            collapsed={collapsed}
            onClick={toggleTheme}
          />
          <SidebarButton
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            collapsed={collapsed}
            onClick={toggleCollapsed}
            className="hidden md:flex"
          />
        </div>
      </aside>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col pl-16 transition-[padding] duration-200',
          !collapsed && 'md:pl-60'
        )}
      >
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-500 px-400 py-600 sm:px-800">
          {notice ? <NoticeBanner notice={notice} onDismiss={() => notify(null)} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  collapsed,
  onClick,
  className,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly collapsed: boolean;
  readonly onClick: () => void;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'flex h-10 items-center gap-300 rounded-lg px-300 text-300 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className
      )}
    >
      <Icon className="icon-size-300 shrink-0" aria-hidden="true" />
      <span className={cn('truncate', 'sr-only', !collapsed && 'md:not-sr-only')}>
        {label}
      </span>
    </button>
  );
}

function NoticeBanner({
  notice,
  onDismiss,
}: {
  readonly notice: Notice;
  readonly onDismiss: () => void;
}) {
  const success = notice.tone === 'success';
  const Icon = success ? CircleCheck : CircleAlert;
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-300 rounded-xl border px-400 py-300 text-300',
        success
          ? 'border-success/40 bg-success/10 text-foreground'
          : 'border-destructive/40 bg-destructive/10 text-destructive'
      )}
    >
      <Icon
        className={cn('mt-100-nudge icon-size-200 shrink-0', success && 'text-success')}
        aria-hidden="true"
      />
      <p className="flex-1">{notice.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="rounded-full p-100 hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="icon-size-200" aria-hidden="true" />
      </button>
    </div>
  );
}
