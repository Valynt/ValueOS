/**
 * EditableField — canonical shared inline-editable text field.
 *
 * Consolidates two previously duplicated local EditableField helpers in:
 *   - views/canvas/HypothesisStage.tsx  (focus border: zinc-500)
 *   - views/canvas/ModelStage.tsx       (focus border: violet-500)
 *
 * The `focusColor` prop allows callers to customise the focus border color
 * without duplicating the entire component.
 */

import React, { useState } from 'react';
import { Check, X, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EditableFieldProps {
  value: string;
  onSave: (v: string) => void;
  /** Tailwind focus border class. Defaults to 'focus:border-zinc-500'. */
  focusColor?: string;
  className?: string;
  /** Optional aria-label for the input when in edit mode. */
  'aria-label'?: string;
}

export function EditableField({
  value,
  onSave,
  focusColor = 'focus:border-zinc-500',
  className,
  'aria-label': ariaLabel,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label={ariaLabel ?? 'Edit field'}>
        <input
          autoFocus
          value={draft}
          aria-label={ariaLabel ?? 'Edit value'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onSave(draft); setEditing(false); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          className={cn(
            'bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[13px] outline-none',
            focusColor,
            className,
          )}
        />
        <button
          onClick={() => { onSave(draft); setEditing(false); }}
          className="p-1 rounded hover:bg-zinc-100"
          aria-label="Save"
        >
          <Check className="w-3 h-3 text-emerald-600" />
        </button>
        <button
          onClick={() => { setDraft(value); setEditing(false); }}
          className="p-1 rounded hover:bg-zinc-100"
          aria-label="Cancel"
        >
          <X className="w-3 h-3 text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ? `Edit ${ariaLabel}` : 'Click to edit'}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditing(true); }}
      className={cn(
        'cursor-pointer hover:bg-zinc-100 rounded px-1 -mx-1 transition-colors group/edit inline-flex items-center gap-1',
        className,
      )}
    >
      {value}
      <Edit3 className="w-3 h-3 text-zinc-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" aria-hidden="true" />
    </span>
  );
}

export default EditableField;
