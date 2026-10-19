//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T; at: Date }
  | { status: 'error'; error: string };

/** Runs a backend read on mount and on `reload`, ignoring stale responses. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const run = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const id = ++run.current;
    setState({ status: 'loading' });
    try {
      const data = await loadRef.current();
      if (id === run.current) setState({ status: 'ready', data, at: new Date() });
    } catch (e) {
      if (id === run.current)
        setState({ status: 'error', error: e instanceof Error ? e.message.replace(/^GraphQL errors:\s*/i, '') : 'Request failed.' });
    }
  }, []);

  useEffect(() => {
    // Fetch on mount and whenever the caller's inputs change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return [state, reload] as const;
}
