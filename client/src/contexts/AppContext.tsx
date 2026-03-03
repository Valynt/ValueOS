import { createContext, useContext, useState, type ReactNode } from "react";
import { organization, tenants, notifications as initialNotifications, type Tenant, type Organization, type Notification } from "@/lib/data";

interface AppContextType {
  org: Organization;
  currentTenant: Tenant;
  setCurrentTenant: (tenant: Tenant) => void;
  tenantList: Tenant[];
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  agentChatOpen: boolean;
  setAgentChatOpen: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant>(tenants[0]);
  const [notifs, setNotifs] = useState<Notification[]>(initialNotifications);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentChatOpen, setAgentChatOpen] = useState(false);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <AppContext.Provider
      value={{
        org: organization,
        currentTenant,
        setCurrentTenant,
        tenantList: tenants,
        notifications: notifs,
        unreadCount,
        markAsRead,
        markAllRead,
        sidebarCollapsed,
        setSidebarCollapsed,
        agentChatOpen,
        setAgentChatOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
