//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  EMPTY_FORM,
  toDateInput,
  toEmployeeRecord,
  validateEmployee,
  validateField,
} from './employees.service';

const valid = {
  FullName: '  Ada Park ',
  Email: 'Ada@Contoso.com',
  Department: 'Engineering',
  JobTitle: 'Engineer',
  Salary: '120,000.50',
  JoiningDate: '2024-01-15',
};

describe('validateEmployee', () => {
  it('normalizes a valid submission', () => {
    const result = validateEmployee(valid);
    expect(result.errors).toBeUndefined();
    expect(result.value).toEqual({
      FullName: 'Ada Park',
      Email: 'ada@contoso.com',
      Department: 'Engineering',
      JobTitle: 'Engineer',
      Salary: 120000.5,
      JoiningDate: new Date('2024-01-15T00:00:00Z'),
    });
  });

  it('requires every field', () => {
    const { errors } = validateEmployee(EMPTY_FORM);
    expect(Object.keys(errors ?? {}).sort()).toEqual(
      ['Department', 'Email', 'FullName', 'JobTitle', 'JoiningDate', 'Salary'].sort()
    );
  });

  it.each([
    ['Email', 'not-an-email'],
    ['Salary', '-5'],
    ['Salary', '10.999'],
    ['Salary', 'abc'],
    ['JoiningDate', '2024-02-31x'],
  ] as const)('rejects %s = %s', (key, value) => {
    const { errors } = validateEmployee({ ...valid, [key]: value });
    expect(errors?.[key]).toBeTruthy();
  });

  it('round-trips a calendar day without a timezone shift', () => {
    expect(toDateInput(new Date('2024-01-15T00:00:00Z'))).toBe('2024-01-15');
  });
});

describe('validateField', () => {
  it('converts each field to its stored type', () => {
    expect(validateField('Salary', '1,250.5').value).toBe(1250.5);
    expect(validateField('Email', ' A@B.co ').value).toBe('a@b.co');
    expect(validateField('JoiningDate', '2024-02-29').value).toEqual(
      new Date('2024-02-29T00:00:00Z')
    );
  });

  it('rejects empty and malformed values', () => {
    expect(validateField('FullName', '   ').error).toBeTruthy();
    expect(validateField('Salary', '1e5').error).toBeTruthy();
    expect(validateField('JoiningDate', '').error).toBeTruthy();
    expect(validateField('JoiningDate', '2026-02-30').error).toBeTruthy();
  });
});

describe('toEmployeeRecord', () => {
  it('resolves the linked department, title and audit users', () => {
    const view = toEmployeeRecord({
      id: 'a',
      EmployeeID: 7,
      FullName: 'Ada',
      Email: 'ada@c.com',
      Salary: '1200.50' as unknown as number,
      JoiningDate: new Date('2024-01-01T00:00:00Z'),
      CreatedAt: new Date('2026-01-01T00:00:00Z'),
      dept_id: 'd',
      dept: { id: 'd', Name: 'Finance' },
      title_id: 't',
      title: { id: 't', Title: 'Analyst' },
      createdBy: { id: 'u', Email: 'maker@c.com', FirstSeenAt: new Date() },
      updatedBy: null,
    });
    expect(view).toMatchObject({
      Department: 'Finance',
      JobTitle: 'Analyst',
      Salary: 1200.5,
      CreatedBy: 'maker@c.com',
      UpdatedBy: null,
      UpdatedAt: null,
    });
  });
});
