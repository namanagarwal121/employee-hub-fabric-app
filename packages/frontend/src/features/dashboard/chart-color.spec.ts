//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { PALETTE, hslToHex, isHexColor } from './chart-color';

describe('chart colour palette', () => {
  it('is a full grid of valid, distinct colours', () => {
    const all = PALETTE.flatMap((c) => c.swatches);
    expect(PALETTE.length).toBeGreaterThan(20);
    expect(new Set(PALETTE.map((c) => c.swatches.length)).size).toBe(1);
    expect(all.every(isHexColor)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it('converts HSL to hex', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 25)).toBe('#008000');
  });

  it('accepts only six-digit hex', () => {
    expect(isHexColor('#1A2b3c')).toBe(true);
    expect(isHexColor('#abc')).toBe(false);
    expect(isHexColor('red')).toBe(false);
  });
});
