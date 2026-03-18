/**
 * AppShell Component - Main application shell with layout
 */

import { ReactNode } from 'react';
import { TopNav } from './TopNav';
import { WorkspaceHeader } from './WorkspaceHeader';
import { MainWorkspace } from './MainWorkspace';
import { BottomTray } from './BottomTray';

interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      <TopNav />
      <WorkspaceHeader />
      <MainWorkspace>{children}</MainWorkspace>
      <BottomTray />
    </div>
  );
}
