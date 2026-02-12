export type SettingsPermission = string;

export interface UserPermissions {
  permissions: SettingsPermission[];
  role: string;
}

export interface SettingsContextType {
  currentRoute: string;
  navigateTo: (route: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasPermission: (permission: SettingsPermission) => boolean;
}
