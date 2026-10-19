//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { authenticated, date, entity, set, text, uuid } from '@microsoft/rayfin-core';

import { callerHas } from './access-policy.js';

/**
 * An append-only record of something a signed-in user did, or tried to do.
 *
 * - Any listed user may add an event, but only under their own email: the
 *   create rule compares `UserEmail` to the caller's email claim, so an event
 *   cannot be attributed to someone else.
 * - Only Admins may read the log.
 * - There is no update or delete permission, so events cannot be changed or
 *   removed through the app's API.
 *
 * Events never hold credentials or employee field values: `Details` names the
 * fields involved, not their contents.
 */
@entity()
@authenticated('read', { policy: (claims) => callerHas(claims, 'admin') })
@authenticated('create', {
  policy: (claims, item) =>
    claims.email.eq(item.UserEmail).and(callerHas(claims, 'readEmployees')),
})
export class AuditEvent {
  @uuid() id!: string;
  @date() OccurredAt!: Date;
  @text({ min: 3, max: 254 }) UserEmail!: string;
  @text({ min: 1, max: 60 }) Action!: string;
  @text({ min: 1, max: 40 }) EntityType!: string;
  @text({ optional: true, max: 64 }) RecordId?: string;
  @set('success', 'failure') Status!: 'success' | 'failure';
  @text({ optional: true, max: 2000 }) Details?: string;
  @text({ optional: true, max: 1000 }) ErrorDetails?: string;
}
