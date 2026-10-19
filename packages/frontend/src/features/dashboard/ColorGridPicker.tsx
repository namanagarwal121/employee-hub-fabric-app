//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Check, ChevronDown, Palette, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import { DEFAULT_CHART_COLOR, PALETTE, isHexColor } from './chart-color';

const ROWS = PALETTE[0]!.swatches.length;
const COLS = PALETTE.length;

/**
 * A grid of colour swatches for the charts. Arrow keys move between swatches,
 * Enter picks one, Escape closes. `null` means the theme's default colour.
 */
export function ColorGridPicker({
  value,
  onChange,
}: {
  readonly value: string | null;
  readonly onChange: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className="inline-flex h-10 items-center gap-200 rounded-lg border border-input bg-card px-300 text-300 font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Palette className="icon-size-200" aria-hidden="true" />
        Chart colour
        <span
          aria-hidden="true"
          className="size-5 rounded-md border border-border"
          style={{ backgroundColor: value ?? DEFAULT_CHART_COLOR }}
        />
        <ChevronDown className="icon-size-200 text-muted-foreground" aria-hidden="true" />
      </button>

      {open ? (
        <ColorPanel
          id={panelId}
          value={value}
          onPick={(color) => {
            onChange(color);
            close();
          }}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function ColorPanel({
  id,
  value,
  onPick,
  onClose,
}: {
  readonly id: string;
  readonly value: string | null;
  readonly onPick: (color: string | null) => void;
  readonly onClose: () => void;
}) {
  const initial = findSwatch(value) ?? { col: 0, row: 5 };
  const [focus, setFocus] = useState(initial);
  const [hex, setHex] = useState(value ?? '');
  const gridRef = useRef<HTMLDivElement>(null);
  const hexId = useId();

  useEffect(() => {
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-cell="${focus.col}-${focus.row}"]`)
      ?.focus();
  }, [focus]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setFocus(({ col, row }) => ({
        col: Math.min(COLS - 1, Math.max(0, col + move[0])),
        row: Math.min(ROWS - 1, Math.max(0, row + move[1])),
      }));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setFocus(({ row }) => ({ col: event.key === 'Home' ? 0 : COLS - 1, row }));
    }
  };

  const normalizedHex = hex.trim().startsWith('#') ? hex.trim() : `#${hex.trim()}`;
  const hexValid = isHexColor(normalizedHex);

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Choose a chart colour"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="absolute right-0 z-40 mt-200 w-[min(calc(100vw-32px),560px)] rounded-xl border border-border bg-popover p-400 text-popover-foreground shadow-2xl"
    >
      <div className="mb-300 flex items-center justify-between gap-300">
        <p className="text-300 font-semibold">Chart colour</p>
        <p className="text-200 text-muted-foreground">Applies to every bar on the dashboard</p>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Colour swatches"
        onKeyDown={onKeyDown}
        className="grid gap-[3px] overflow-x-auto"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(14px, 1fr))` }}
      >
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} role="row" className="contents">
            {PALETTE.map((column, col) => {
              const swatch = column.swatches[row]!;
              const selected = value?.toLowerCase() === swatch;
              return (
                <button
                  key={swatch + col}
                  type="button"
                  role="gridcell"
                  data-cell={`${col}-${row}`}
                  tabIndex={focus.col === col && focus.row === row ? 0 : -1}
                  aria-label={`${column.name} ${swatch}`}
                  aria-selected={selected}
                  onClick={() => onPick(swatch)}
                  onFocus={() => setFocus({ col, row })}
                  className={cn(
                    'relative aspect-square min-w-[14px] rounded-[3px] outline-none transition-transform hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover',
                    selected && 'z-10 ring-2 ring-foreground ring-offset-1 ring-offset-popover'
                  )}
                  style={{ backgroundColor: swatch }}
                >
                  {selected ? (
                    <Check
                      className="absolute inset-0 m-auto icon-size-100 text-white mix-blend-difference"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hexValid) onPick(normalizedHex.toLowerCase());
        }}
        className="mt-400 flex flex-wrap items-center gap-200 border-t border-border pt-400"
      >
        <label htmlFor={hexId} className="text-200 font-medium text-muted-foreground">
          Hex
        </label>
        <span
          aria-hidden="true"
          className="size-6 rounded-md border border-border"
          style={{ backgroundColor: hexValid ? normalizedHex : 'transparent' }}
        />
        <input
          id={hexId}
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          placeholder={DEFAULT_CHART_COLOR}
          maxLength={7}
          aria-invalid={hex !== '' && !hexValid ? true : undefined}
          className="h-8 w-28 rounded-md border border-input bg-background px-200 font-monospace text-200 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          type="submit"
          disabled={!hexValid}
          className="h-8 rounded-md bg-primary px-300 text-200 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="ml-auto inline-flex h-8 items-center gap-100 rounded-md px-300 text-200 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <RotateCcw className="icon-size-100" aria-hidden="true" />
          Reset to default
        </button>
      </form>
    </div>
  );
}

function findSwatch(value: string | null): { col: number; row: number } | null {
  if (!value) return null;
  for (let col = 0; col < COLS; col++) {
    const row = PALETTE[col]!.swatches.indexOf(value.toLowerCase());
    if (row >= 0) return { col, row };
  }
  return null;
}
