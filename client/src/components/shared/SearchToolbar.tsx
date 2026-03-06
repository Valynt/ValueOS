/*
 * SearchToolbar — Consistent search input + filter/sort buttons + view toggle.
 * Replaces the duplicated toolbar pattern in Cases, CompanyIntel, etc.
 *
 * Usage:
 *   <SearchToolbar
 *     value={search}
 *     onChange={setSearch}
 *     placeholder="Search cases..."
 *     showViewToggle
 *     view={view}
 *     onViewChange={setView}
 *   />
 */
import { Search, Filter, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show filter button */
  showFilter?: boolean;
  /** Show sort button */
  showSort?: boolean;
  /** Show list/grid toggle */
  showViewToggle?: boolean;
  view?: "list" | "grid";
  onViewChange?: (view: "list" | "grid") => void;
  /** Additional actions on the right */
  actions?: React.ReactNode;
  className?: string;
}

export function SearchToolbar({
  value,
  onChange,
  placeholder = "Search...",
  showFilter = true,
  showSort = true,
  showViewToggle = false,
  view = "list",
  onViewChange,
  actions,
  className,
}: SearchToolbarProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
        />
      </div>

      {showFilter && (
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-sm"
          onClick={() => toast("Filters coming soon")}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      )}

      {showSort && (
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-sm"
          onClick={() => toast("Sorting coming soon")}
        >
          <ArrowUpDown className="w-4 h-4 mr-2" />
          Sort
        </Button>
      )}

      {actions}

      {showViewToggle && onViewChange && (
        <div className="flex items-center border border-border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => onViewChange("list")}
            className={cn(
              "w-10 h-10 flex items-center justify-center transition-colors",
              view === "list" ? "bg-accent" : "hover:bg-accent/50"
            )}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange("grid")}
            className={cn(
              "w-10 h-10 flex items-center justify-center transition-colors",
              view === "grid" ? "bg-accent" : "hover:bg-accent/50"
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
