/**
 * MainWorkspace Component - 3-column layout with resizable panels
 */

import { ReactNode } from 'react';
import { LeftRail } from './LeftRail';
import { CenterCanvas } from './CenterCanvas';
import { RightInspector } from './RightInspector';

interface MainWorkspaceProps {
  children?: ReactNode;
}

export function MainWorkspace({ children }: MainWorkspaceProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <LeftRail />
      <CenterCanvas>{children}</CenterCanvas>
      <RightInspector />
    </div>
  );
}
