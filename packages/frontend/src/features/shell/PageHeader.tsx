//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-300 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-heading text-hero-800 leading-hero-800 font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-100 text-300 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-300">{actions}</div> : null}
    </header>
  );
}

export function RefreshButton({
  refreshing,
  onClick,
}: {
  readonly refreshing: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      className="inline-flex h-10 items-center gap-200 rounded-lg border border-input bg-card px-400 text-300 font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
    >
      <RefreshCw className={cn('icon-size-200', refreshing && 'animate-spin')} aria-hidden="true" />
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
