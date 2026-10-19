//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('parses quotes, escaped quotes, CRLF, a BOM and trailing blank lines', () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('round-trips and neutralises formula-like cells', () => {
    const csv = toCsv([['name', 'note'], ['A, B', '=SUM(1)'], ['C', '-12.5']]);
    expect(csv).toBe('name,note\r\n"A, B",\'=SUM(1)\r\nC,-12.5');
    expect(parseCsv(csv)[1]).toEqual(['A, B', "'=SUM(1)"]);
  });
});
