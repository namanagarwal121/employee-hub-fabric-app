//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { assignmentFor, emailsWith, type RoleAssignment } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

const list: RoleAssignment[] = [
  { email: 'admin@c.com', name: 'A', role: 'Admin', status: 'active', addedAt: '2026-01-01' },
  { email: 'hr@c.com', name: 'H', role: 'HR Manager', status: 'active', addedAt: '2026-01-01' },
  { email: 'view@c.com', name: 'V', role: 'Viewer', status: 'active', addedAt: '2026-01-01' },
  { email: 'gone@c.com', name: 'G', role: 'Admin', status: 'inactive', addedAt: '2026-01-01' },
];

describe('role rules', () => {
  it('lists only active holders of each capability', () => {
    expect(emailsWith('admin', list)).toEqual(['admin@c.com']);
    expect(emailsWith('writeEmployees', list)).toEqual(['admin@c.com', 'hr@c.com']);
    expect(emailsWith('readEmployees', list)).toEqual(['admin@c.com', 'hr@c.com', 'view@c.com']);
  });

  it('matches emails without regard to case and denies unknown people', () => {
    expect(assignmentFor('HR@C.com', list)?.role).toBe('HR Manager');
    expect(assignmentFor('nobody@c.com', list)).toBeNull();
    expect(assignmentFor(undefined, list)).toBeNull();
  });
});
