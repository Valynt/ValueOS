import React, { useEffect, useState } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { LibraryView } from './views/LibraryView';
import { TemplatesView } from './views/TemplatesView';
import { SettingsView } from './views/Settings/SettingsView';
import { DocumentationView } from './views/DocumentationView';
import { OpportunityWorkspace } from './views/OpportunityWorkspace';
import { TargetROIWorkspace } from './views/TargetROIWorkspace';
import { ExpansionInsightPage } from './views/ExpansionInsightPage';
import { IntegrityCompliancePage } from './views/IntegrityCompliancePage';
import { PerformanceDashboard } from './views/PerformanceDashboard';
import { AppSidebar } from './components/Navigation/AppSidebar';
import { SDUIApp } from './components/SDUIApp';
import { ChatCanvasLayout } from './components/ChatCanvas';
import { ViewMode } from './types';
import { LifecycleStage } from './types/workflow';
import { sessionManager } from './services/SessionManager';

// Feature flags
const ENABLE_SDUI = import.meta.env.VITE_ENABLE_SDUI === 'true' || false;
// Chat + Canvas UI is now the default experience
const ENABLE_CHAT_CANVAS = true;

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('library');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [sduiWorkspaceId, setSduiWorkspaceId] = useState<string | null>(null);
  const [sduiStage, setSduiStage] = useState<LifecycleStage>('opportunity');

  useEffect(() => {
    sessionManager.initialize();
    return () => sessionManager.terminate();
  }, []);

  const handleOpenCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('canvas');
  };

  const handleCreateNew = () => {
    setSelectedCaseId(null);
    setCurrentView('canvas');
  };

  const handleUseTemplate = (templateId: string) => {
    setSelectedCaseId(null);
    setCurrentView('canvas');
  };

  const handleBackToLibrary = () => {
    setCurrentView('library');
    setSelectedCaseId(null);
  };

  const renderView = () => {
    // If SDUI is enabled and we have a workspace, use SDUI rendering
    if (ENABLE_SDUI && sduiWorkspaceId) {
      return (
        <SDUIApp
          workspaceId={sduiWorkspaceId}
          userId="anonymous"
          initialStage={sduiStage}
          sessionId="default"
          debug={import.meta.env.DEV}
        />
      );
    }

    // Otherwise, use traditional React views
    switch (currentView) {
      case 'library':
        return <LibraryView onOpenCase={handleOpenCase} onCreateNew={handleCreateNew} />;

      case 'canvas':
        return <MainLayout onBack={handleBackToLibrary} caseId={selectedCaseId} />;

      case 'opportunity':
        // If SDUI enabled, switch to SDUI mode
        if (ENABLE_SDUI && selectedCaseId) {
          setSduiWorkspaceId(selectedCaseId);
          setSduiStage('opportunity');
          return null;
        }
        return <OpportunityWorkspace />;

      case 'target':
        // If SDUI enabled, switch to SDUI mode
        if (ENABLE_SDUI && selectedCaseId) {
          setSduiWorkspaceId(selectedCaseId);
          setSduiStage('target');
          return null;
        }
        return <TargetROIWorkspace />;

      case 'expansion':
        // If SDUI enabled, switch to SDUI mode
        if (ENABLE_SDUI && selectedCaseId) {
          setSduiWorkspaceId(selectedCaseId);
          setSduiStage('expansion');
          return null;
        }
        return <ExpansionInsightPage />;

      case 'integrity':
        // If SDUI enabled, switch to SDUI mode
        if (ENABLE_SDUI && selectedCaseId) {
          setSduiWorkspaceId(selectedCaseId);
          setSduiStage('integrity');
          return null;
        }
        return <IntegrityCompliancePage />;

      case 'templates':
        return <TemplatesView onUseTemplate={handleUseTemplate} />;

      case 'settings':
        return <SettingsView />;

      case 'documentation':
        return <DocumentationView />;

      case 'performance':
        return <PerformanceDashboard />;

      default:
        return null;
    }
  };

  // If Chat + Canvas mode is enabled, use the simplified layout
  if (ENABLE_CHAT_CANVAS) {
    return (
      <ChatCanvasLayout
        onSettingsClick={() => setCurrentView('settings')}
        onHelpClick={() => setCurrentView('documentation')}
      />
    );
  }

  // Legacy multi-view layout
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Hide sidebar in SDUI mode or specific views */}
      {!sduiWorkspaceId && currentView !== 'canvas' && currentView !== 'settings' && currentView !== 'documentation' && (
        <AppSidebar currentView={currentView} onNavigate={setCurrentView} />
      )}
      {renderView()}
    </div>
  );
}

export default App;