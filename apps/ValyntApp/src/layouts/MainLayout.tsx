import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AgentChatSidebar } from "./AgentChatSidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigationPersonalization } from "@/hooks/useNavigationPersonalization";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const storageScope = user?.id ?? currentTenant?.id ?? "anon";
  const { recordRouteVisit } = useNavigationPersonalization(storageScope);

  useEffect(() => {
    recordRouteVisit(pathname);
  }, [pathname, recordRouteVisit]);

  return (
    <div className="flex h-screen bg-[#fafafa] text-zinc-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onAgentOpen={() => setAgentOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <AgentChatSidebar open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}

export default MainLayout;
