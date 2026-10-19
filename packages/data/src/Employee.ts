//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  authenticated,
  date,
  decimal,
  email,
  entity,
  int,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { callerHas } from './access-policy.js';
import { AppUser } from './AppUser.js';
import { Department } from './Department.js';
import { JobTitle } from './JobTitle.js';

/**
 * One employee. Department, job title and the audit users live in their own
 * tables and are referenced by key.
 *
 * Rayfin requires a UUID `id` primary key, so the human-facing integer
 * `EmployeeID` is a separate unique column that the app numbers sequentially.
 * Access follows `ROLE_ASSIGNMENTS` in `@rayfin-app/shared`: every listed
 * active user may read; only Admins and HR Managers may create, edit or
 * delete. Unlisted users are denied. An update may never change
 * `EmployeeID`, `CreatedAt` or who created the row.
 * The audit links are optional: rows inserted with SQL have no app user.
 */
@entity()
@authenticated('read', { policy: (claims) => callerHas(claims, 'readEmployees') })
@authenticated('create', { policy: (claims) => callerHas(claims, 'writeEmployees') })
@authenticated('delete', { policy: (claims) => callerHas(claims, 'writeEmployees') })
@authenticated('update', {
  policy: (claims) => callerHas(claims, 'writeEmployees'),
  exclude: ['EmployeeID', 'CreatedAt', 'createdBy_id'],
})
export class Employee {
  @uuid() id!: string;
  @int({ unique: true, min: 1 }) EmployeeID!: number;
  @text({ min: 1, max: 150 }) FullName!: string;
  @email({ unique: true, max: 254 }) Email!: string;
  @decimal({ precision: 12, scale: 2, min: 0 }) Salary!: number;
  @date() JoiningDate!: Date;
  @date() CreatedAt!: Date;
  @date({ optional: true }) UpdatedAt?: Date;

  @uuid() dept_id!: string;
  @one(() => Department) dept?: Department;
  @uuid() title_id!: string;
  @one(() => JobTitle) title?: JobTitle;
  @uuid({ optional: true }) createdBy_id?: string;
  @one(() => AppUser, { optional: true }) createdBy?: AppUser;
  @uuid({ optional: true }) updatedBy_id?: string;
  @one(() => AppUser, { optional: true }) updatedBy?: AppUser;
}
