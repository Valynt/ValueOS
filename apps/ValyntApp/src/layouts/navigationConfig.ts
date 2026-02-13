export interface NavigationItem {
  path: string;
  label: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { path: "/dashboard", label: "My Work" },
  { path: "/opportunities", label: "Cases" },
  { path: "/models", label: "Models" },
  { path: "/agents", label: "Agents" },
  { path: "/company", label: "Company Intel" },
  { path: "/settings", label: "Settings" },
];

export const NAV_LABEL_BY_PATH = NAVIGATION_ITEMS.reduce<Record<string, string>>((acc, item) => {
  acc[item.path] = item.label;
  return acc;
}, {});
