//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ModalProps {
  readonly title: string;
  readonly description?: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly role?: 'dialog' | 'alertdialog';
  readonly className?: string;
}

/** A native modal dialog: focus trapping and Escape come from the browser. */
export function Modal({
  title,
  description,
  onClose,
  children,
  role = 'dialog',
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal?.();
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby="modal-title"
      className={cn(
        'm-auto w-[calc(100%-32px)] max-w-xl rounded-2xl border border-border bg-card p-none text-card-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-[2px]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-400 border-b border-border px-600 py-500">
        <div className="min-w-0">
          <h2
            id="modal-title"
            className="font-heading text-hero-700 leading-hero-700"
          >
            {title}
          </h2>
          {description ? (
            <div className="mt-100 text-300 leading-300 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-200 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="icon-size-300" aria-hidden="true" />
        </button>
      </div>
      <div className="px-600 py-500">{children}</div>
    </dialog>
  );
}
