//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ROLE_CAPABILITIES, type Capability, type RoleAssignment } from '@rayfin-app/shared';
import { createContext, useContext } from 'react';

export interface AccessValue {
  /** The signed-in email from the authenticated session. */
  readonly email: string;
  /** The active assignment for that email, or null when access is denied. */
  readonly assignment: RoleAssignment | null;
}

export const AccessContext = createContext<AccessValue | null>(null);

/**
 * The signed-in user's role. This only shapes the UI; the same assignments are
 * enforced by the server's data permissions.
 */
export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error('useAccess must be used inside AccessProvider.');
  const can = (capability: Capability) =>
    value.assignment?.status === 'active' && ROLE_CAPABILITIES[value.assignment.role][capability];
  return { ...value, can };
}
