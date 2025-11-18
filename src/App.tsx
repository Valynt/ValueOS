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
import { ViewMode } from './types';
import { sessionManager } from './services/SessionManager';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('library');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

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
    switch (currentView) {
      case 'library':
        return <LibraryView onOpenCase={handleOpenCase} onCreateNew={handleCreateNew} />;

      case 'canvas':
        return <MainLayout onBack={handleBackToLibrary} caseId={selectedCaseId} />;

      case 'opportunity':
        return <OpportunityWorkspace />;

      case 'target':
        return <TargetROIWorkspace />;

      case 'expansion':
        return <ExpansionInsightPage />;

      case 'integrity':
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

  return (
    <div className="flex h-screen overflow-hidden">
      {currentView !== 'canvas' && currentView !== 'settings' && currentView !== 'documentation' && (
        <AppSidebar currentView={currentView} onNavigate={setCurrentView} />
      )}
      {renderView()}
    </div>
  );
}

export default App;