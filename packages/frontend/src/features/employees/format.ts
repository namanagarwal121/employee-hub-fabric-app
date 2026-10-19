//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

const salary = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const calendarDay = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const timestamp = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatEmployeeId = (id: number) =>
  `EMP-${String(id).padStart(4, '0')}`;

export const formatSalary = (value: number) => salary.format(value);

/** Joining dates are calendar days stored at midnight UTC. */
export const formatDay = (value: Date | string) =>
  calendarDay.format(new Date(value));

export const formatTimestamp = (value: Date | string) =>
  timestamp.format(new Date(value));

/** A calendar day as YYYY-MM-DD (joining dates are stored at midnight UTC). */
export const toIsoDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
