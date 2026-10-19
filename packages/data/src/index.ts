//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { AppUser } from './AppUser.js';
import { AuditEvent } from './AuditEvent.js';
import { Department } from './Department.js';
import { Employee } from './Employee.js';
import { JobTitle } from './JobTitle.js';
import type { UniversalAppSchema } from '@rayfin-app/shared';

/**
 * The app's Rayfin data schema.
 *
 * Keep `UniversalAppSchema` in `@rayfin-app/shared` in step with `schema`
 * below: a class registered here but missing from the shared type is
 * reachable at runtime and invisible to the compiler.
 */
export type { UniversalAppSchema };
export { AppUser, AuditEvent, Department, Employee, JobTitle };

export const schema = [Department, JobTitle, AppUser, Employee, AuditEvent];
