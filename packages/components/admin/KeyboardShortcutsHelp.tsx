/**
 * Keyboard Shortcuts Help Dialog
 * 
 * Shows all available keyboard shortcuts (⌘+/)
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Command } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  {
    keys: ['⌘', 'S'],
    description: 'Save all pending changes',
    category: 'General'
  },
  {
    keys: ['⌘', 'K'],
    description: 'Open command palette',
    category: 'General'
  },
  {
    keys: ['⌘', '/'],
    description: 'Show keyboard shortcuts',
    category: 'General'
  },
  {
    keys: ['ESC'],
    description: 'Close dialog or cancel',
    category: 'General'
  },
  {
    keys: ['Tab'],
    description: 'Navigate between tabs',
    category: 'Navigation'
  },
  {
    keys: ['↑', '↓'],
    description: 'Navigate command palette',
    category: 'Navigation'
  },
  {
    keys: ['↵'],
    description: 'Select command',
    category: 'Navigation'
  }
];

const categories = Array.from(new Set(shortcuts.map(s => s.category)));

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and manage configurations faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
                              {key}
                            </kbd>
                            {i < shortcut.keys.length - 1 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Tip:</strong> On Windows/Linux, use{' '}
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
              Ctrl
            </kbd>{' '}
            instead of{' '}
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
              ⌘
            </kbd>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
