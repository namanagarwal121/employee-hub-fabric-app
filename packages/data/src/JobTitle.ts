//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { authenticated, entity, many, text, uuid } from '@microsoft/rayfin-core';

import { callerHas } from './access-policy.js';
import { Employee } from './Employee.js';

/** One row per job title; employees link to it instead of repeating the text. */
@entity()
@authenticated('read', { policy: (claims) => callerHas(claims, 'readEmployees') })
@authenticated('create', { policy: (claims) => callerHas(claims, 'writeEmployees') })
@authenticated('update', { policy: (claims) => callerHas(claims, 'writeEmployees') })
@authenticated('delete', { policy: (claims) => callerHas(claims, 'writeEmployees') })
export class JobTitle {
  @uuid() id!: string;
  @text({ min: 1, max: 150, unique: true }) Title!: string;
  @many(() => Employee) employees?: Employee[];
}
