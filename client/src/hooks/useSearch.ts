/*
 * useSearch — Generic search/filter hook for list pages.
 * Extracts the duplicated search + filter pattern from Cases, CompanyIntel, etc.
 *
 * Usage:
 *   const { query, setQuery, filtered } = useSearch(items, ["company", "title", "caseNumber"]);
 */
import { useState, useMemo } from "react";

export function useSearch<T>(
  items: T[],
  searchFields: (keyof T)[],
  initialQuery = ""
) {
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter((item) =>
      searchFields.some((field) => {
        const val = item[field];
        return typeof val === "string" && val.toLowerCase().includes(lower);
      })
    );
  }, [items, query, searchFields]);

  return { query, setQuery, filtered };
}
