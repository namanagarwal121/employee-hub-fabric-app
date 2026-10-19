//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { assignmentFor } from '@rayfin-app/shared';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { getRayfinClient } from '@/lib/rayfin-client';

import { AccessContext, type AccessValue } from './access.context';

/**
 * Resolves the signed-in user's role from their authenticated session. People
 * without an active role see an explanation instead of the app; the server
 * would refuse their data requests anyway.
 */
export function AccessProvider({ children }: { readonly children: ReactNode }) {
  const [value, setValue] = useState<AccessValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const client = await getRayfinClient();
        const email = client.auth.getSession().user?.email ?? '';
        if (alive) setValue({ email, assignment: assignmentFor(email) });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not read your sign-in.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <NoAccess title="Your sign-in could not be read" body={error} />;
  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-300 text-muted-foreground">
        Checking your access…
      </div>
    );
  }
  if (!value.assignment || value.assignment.status !== 'active') {
    return (
      <NoAccess
        title={value.assignment ? 'Your account is deactivated' : 'You don’t have a role in Employee Hub'}
        body={`You are signed in as ${value.email || 'an account without an email'}. Ask an Employee Hub Admin to ${
          value.assignment ? 'reactivate' : 'add'
        } you. Until then the server refuses employee data for this account.`}
      />
    );
  }
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

function NoAccess({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-400">
      <div role="alert" className="flex max-w-md flex-col items-center gap-300 rounded-xl border border-border bg-card p-800 text-center">
        <ShieldAlert className="icon-size-600 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-500 font-semibold">{title}</h1>
        <p className="text-300 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
