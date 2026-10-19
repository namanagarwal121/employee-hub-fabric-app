//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useEffect, useState } from 'react';

export type Section = 'dashboard' | 'data' | 'admin';

function readSection(): Section {
  const hash = window.location.hash;
  if (hash === '#data') return 'data';
  if (hash === '#admin' || hash.startsWith('#admin/')) return 'admin';
  return 'dashboard';
}

/** The current section, kept in the URL hash so a reload stays put. */
export function useSection(): [Section, (next: Section) => void] {
  const [section, setSection] = useState<Section>(readSection);
  useEffect(() => {
    const onHash = () => setSection(readSection());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (next: Section) => {
    if (next !== section) window.location.hash = next;
    setSection(next);
  };
  return [section, go];
}
