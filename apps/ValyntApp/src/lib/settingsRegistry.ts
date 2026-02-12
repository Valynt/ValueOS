export interface SettingsRegistry {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  getGroup(group: string): Record<string, unknown>;
  saveSetting(key: string, value: unknown): Promise<void>;
  update(key: string, value: unknown): void;
  getRoute(key: string): string | undefined;
  getBreadcrumbs(): Array<{ label: string; path: string }>;
  value?: unknown;
}

export const settingsRegistry: SettingsRegistry = {
  get: (_key: string) => undefined,
  set: (_key: string, _value: unknown) => {},
  getGroup: (_group: string) => ({}),
  saveSetting: async (_key: string, _value: unknown) => {},
  update: (_key: string, _value: unknown) => {},
  getRoute: (_key: string) => undefined,
  getBreadcrumbs: () => [],
};

export function useSettings() {
  return settingsRegistry;
}

export function useSettingsGroup(_group: string): Record<string, unknown> {
  return {};
}
