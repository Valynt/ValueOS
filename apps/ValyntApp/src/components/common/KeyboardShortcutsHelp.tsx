/**
 * KeyboardShortcutsHelp Modal
 *
 * Displays all available keyboard shortcuts grouped by category.
 * Accessible via Ctrl+? or ? key.
 */

import { Keyboard, X } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DEFAULT_SHORTCUTS,
  formatShortcut,
  type KeyboardShortcut,
} from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts?: KeyboardShortcut[];
  customTitle?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: "Navigation",
  action: "Actions",
  workflow: "Workflow",
  ui: "Interface",
};

const CATEGORY_ICONS: Record<string, string> = {
  navigation: "🧭",
  action: "⚡",
  workflow: "🔄",
  ui: "🖱️",
};

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
  shortcuts = DEFAULT_SHORTCUTS,
  customTitle = "Keyboard Shortcuts",
}: KeyboardShortcutsHelpProps) {
  // Group shortcuts by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    const cat = shortcut.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  // Sort categories in preferred order
  const categoryOrder = ["navigation", "action", "workflow", "ui"];
  const sortedCategories = categoryOrder.filter((cat) => grouped[cat]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Keyboard className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">{customTitle}</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> anytime to
            show this help. Shortcuts work globally except when typing in inputs.
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {sortedCategories.map((category) => (
            <div key={category} className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <span>{CATEGORY_ICONS[category]}</span>
                {CATEGORY_LABELS[category]}
              </h3>

              <div className="grid gap-2">
                {grouped[category].map((shortcut, index) => (
                  <div
                    key={`${shortcut.key}-${index}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs font-mono whitespace-nowrap">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> On Mac, use <kbd className="px-1 bg-muted rounded">⌘</kbd> instead
            of <kbd className="px-1 bg-muted rounded">Ctrl</kbd>
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsHelp;
