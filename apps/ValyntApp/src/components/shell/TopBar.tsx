/**
 * Shell Layer: TopBar
 * Header with case title and command bar trigger
 */

import { Search } from "lucide-react";

interface TopBarProps {
  title: string;
  onCommandBarOpen: () => void;
}

export function TopBar({ title, onCommandBarOpen }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCommandBarOpen}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span>Ask AI...</span>
          <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">⌘K</kbd>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
