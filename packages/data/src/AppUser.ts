//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { authenticated, date, entity, text, uuid } from '@microsoft/rayfin-core';

import { callerHas } from './access-policy.js';

/**
 * A signed-in person who has created or edited employee records. Each email is
 * stored once and referenced by Employees.createdBy / updatedBy.
 *
 * Only Admins and HR Managers (the people who edit) register, and only their
 * own email: the create rule compares the row to the caller's email claim.
 * Rows are never edited or removed by the app.
 */
@entity()
@authenticated('read', { policy: (claims) => callerHas(claims, 'readEmployees') })
@authenticated('create', {
  policy: (claims, item) =>
    claims.email.eq(item.Email).and(callerHas(claims, 'writeEmployees')),
})
export class AppUser {
  @uuid() id!: string;
  @text({ min: 3, max: 254, unique: true }) Email!: string;
  @date() FirstSeenAt!: Date;
}
