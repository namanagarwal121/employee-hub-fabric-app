//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Panel({
  title,
  description,
  actions,
  className,
  children,
}: {
  readonly title?: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn('flex min-w-0 flex-col rounded-xl border border-border bg-card', className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-300 border-b border-border px-500 py-400">
          <div className="min-w-0">
            <h2 className="text-400 font-semibold">{title}</h2>
            {description ? <p className="mt-100-nudge text-200 text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-200">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly tone?: 'neutral' | 'warning' | 'danger';
}) {
  return (
    <div className="flex flex-col gap-200 rounded-xl border border-border bg-card p-500">
      <div className="flex items-center justify-between gap-200">
        <p className="text-300 font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-lg',
            tone === 'danger' ? 'bg-destructive/10 text-destructive' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'
          )}
        >
          <Icon className="icon-size-200" aria-hidden="true" />
        </span>
      </div>
      <p className="font-numeric text-hero-700 leading-hero-700 font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="min-h-200 text-200 text-muted-foreground">{hint ?? ' '}</p>
    </div>
  );
}

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unverified' | 'checking' | 'info';

const STATUS: Record<HealthStatus, { label: string; icon: LucideIcon; className: string }> = {
  healthy: { label: 'Verified', icon: CircleCheck, className: 'border-success/40 bg-success/10 text-success' },
  warning: { label: 'Warning', icon: TriangleAlert, className: 'border-warning/40 bg-warning/15 text-warning' },
  error: { label: 'Failing', icon: CircleAlert, className: 'border-destructive/40 bg-destructive/10 text-destructive' },
  unverified: { label: 'Not verified', icon: CircleHelp, className: 'border-border bg-muted text-muted-foreground' },
  checking: { label: 'Checking…', icon: LoaderCircle, className: 'border-border bg-muted text-muted-foreground' },
  info: { label: 'Not in use', icon: CircleDashed, className: 'border-border bg-muted text-muted-foreground' },
};

export function StatusBadge({ status, label }: { readonly status: HealthStatus; readonly label?: string }) {
  const { icon: Icon, className, label: fallback } = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-100 rounded-full border px-200 py-100 text-200 font-semibold whitespace-nowrap', className)}>
      <Icon className={cn('icon-size-100', status === 'checking' && 'animate-spin')} aria-hidden="true" />
      {label ?? fallback}
    </span>
  );
}

export function OutcomeBadge({ status }: { readonly status: 'success' | 'failure' }) {
  return status === 'success' ? (
    <StatusBadge status="healthy" label="Success" />
  ) : (
    <StatusBadge status="error" label="Failure" />
  );
}

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-200 rounded-lg px-300 text-300 font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'border border-input bg-card hover:bg-accent',
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className
      )}
    />
  );
}

export const inputClass =
  'h-9 rounded-lg border border-input bg-background px-300 text-300 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30';

export const th = 'px-400 py-300 text-left text-200 font-semibold whitespace-nowrap uppercase tracking-wider text-muted-foreground';
export const td = 'px-400 py-300 align-top';

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  readonly tone?: 'info' | 'warning' | 'danger';
  readonly title: string;
  readonly children?: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn(
        'rounded-xl border px-400 py-300 text-300',
        tone === 'info' && 'border-primary/30 bg-primary/5',
        tone === 'warning' && 'border-warning/40 bg-warning/10',
        tone === 'danger' && 'border-destructive/40 bg-destructive/10 text-destructive'
      )}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-100 text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { readonly rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-200 p-400">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
