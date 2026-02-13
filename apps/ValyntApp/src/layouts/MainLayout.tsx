import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AgentChatSidebar } from "./AgentChatSidebar";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#fafafa] text-zinc-900 overflow-x-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 max-w-full transform transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          onAgentOpen={() => setAgentOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Agent chat sidebar */}
      <AgentChatSidebar open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}

export default MainLayout;
