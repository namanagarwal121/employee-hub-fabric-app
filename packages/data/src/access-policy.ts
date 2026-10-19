//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ClaimsDsl, PolicyExpression } from '@microsoft/rayfin-core';
import { emailsWith, type Capability } from '@rayfin-app/shared';

/** Matches no real sign-in, so an empty role list denies everyone. */
const NOBODY = 'nobody@invalid.example';

/**
 * A server-side rule: the caller's email claim must be one of the active
 * emails holding `capability` in `ROLE_ASSIGNMENTS`.
 */
export function callerHas(claims: ClaimsDsl, capability: Capability): PolicyExpression {
  const emails = emailsWith(capability);
  const [first = NOBODY, ...rest] = emails;
  return rest.reduce<PolicyExpression>(
    (expr, email) => expr.or(claims.email.eq(email)),
    claims.email.eq(first)
  );
}
