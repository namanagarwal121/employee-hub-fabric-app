//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useState } from 'react';

const STORAGE_KEY = 'employee-hub.chart-color';

/** What the charts draw when no colour is chosen (the visuals theme's first series colour). */
export const DEFAULT_CHART_COLOR = '#118dff';
const HEX = /^#[0-9a-f]{6}$/i;

/** Columns of hue from red round to magenta, then warm browns and greys. */
const HUES = Array.from({ length: 24 }, (_, i) => i * 15);
/** Rows from the palest tint down to the deepest shade. */
const LIGHTNESS = [92, 85, 78, 70, 62, 55, 48, 42, 36, 30, 24, 18];

export interface PaletteColumn {
  readonly name: string;
  readonly swatches: readonly string[];
}

/** A grid of colours, one column per hue and one row per lightness step. */
export const PALETTE: readonly PaletteColumn[] = [
  ...HUES.map((hue) => ({
    name: hueName(hue),
    swatches: LIGHTNESS.map((l) => hslToHex(hue, l > 80 ? 70 : 75, l)),
  })),
  { name: 'Brown', swatches: LIGHTNESS.map((l) => hslToHex(28, 35, l)) },
  { name: 'Grey', swatches: LIGHTNESS.map((l) => hslToHex(215, 10, l)) },
];

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

/**
 * The bar and line colour for every chart, or null for the theme's default.
 * Remembered per viewer in this browser only.
 */
export function useChartColor(): [string | null, (next: string | null) => void] {
  const [color, setColor] = useState<string | null>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored && isHexColor(stored) ? stored : null;
    } catch {
      return null;
    }
  });
  const update = (next: string | null) => {
    setColor(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The choice still applies for this visit.
    }
  };
  return [color, update];
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function hueName(hue: number): string {
  const names: [number, string][] = [
    [15, 'Red'], [45, 'Orange'], [70, 'Yellow'], [100, 'Lime'], [150, 'Green'],
    [190, 'Teal'], [215, 'Sky'], [250, 'Blue'], [285, 'Violet'], [320, 'Magenta'],
    [345, 'Pink'], [360, 'Red'],
  ];
  return names.find(([max]) => hue < max)?.[1] ?? 'Red';
}
