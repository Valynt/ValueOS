import React, { useState, useEffect, useCallback } from 'react';
import { agentOrchestrator, StreamingUpdate } from '../../services/AgentOrchestratorAdapter';
import { persistenceService } from '../../services/PersistenceService';
import { suggestionEngine } from '../../services/SuggestionEngine';
import { calculationEngine } from '../../services/CalculationEngine';
import { Canvas } from './Canvas';
import { ControlsPanel } from './ControlsPanel';
import { Toolbar } from './Toolbar';
import { SaveIndicator } from '../Common/SaveIndicator';
import { CommandBar } from '../Agent/CommandBar';
import { GhostPreview } from '../Agent/GhostPreview';
import { SuggestionCard, Suggestion } from '../Agent/SuggestionCard';
import { StreamingIndicator } from '../Agent/StreamingIndicator';
import { HistoryPanel } from '../History/HistoryPanel';
import { RippleEffect } from '../Canvas/RippleEffect';
import { DeltaBadge } from '../Canvas/DeltaBadge';
import { DependencyLine } from '../Canvas/DependencyLine';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel';
import { PresentationMode } from './PresentationMode';
import { CanvasComponent } from '../../types';
import { History, Undo, Redo, HelpCircle, Presentation, ArrowLeft } from 'lucide-react';

interface MainLayoutProps {
  onBack?: () => void;
  caseId?: string | null;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ onBack, caseId: propCaseId }) => {
  const [caseId] = useState(propCaseId || 'demo-case-id');
  const [selectedComponent, setSelectedComponent] = useState<CanvasComponent | null>(null);
  const [canvasComponents, setCanvasComponents] = useState<CanvasComponent[]>([]);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [ghostPreview, setGhostPreview] = useState<Omit<CanvasComponent, 'id'> | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving' | 'error'>('idle');
  const [highlightedComponentId, setHighlightedComponentId] = useState<string | null>(null);
  const [streamingUpdate, setStreamingUpdate] = useState<StreamingUpdate | null>(null);
  const [rippleEffects, setRippleEffects] = useState<Array<{ id: string; componentId: string; position: { x: number; y: number } }>>([]);
  const [deltaBadges, setDeltaBadges] = useState<Array<{ id: string; componentId: string; oldValue: any; newValue: any; position: { x: number; y: number } }>>([]);
  const [dependencyLines, setDependencyLines] = useState<Array<{ id: string; from: any; to: any }>>([]);
  const [recentChanges, setRecentChanges] = useState<Array<{ componentId: string; changeType: string; timestamp: Date }>>([]);
  const [isShortcutsPanelOpen, setIsShortcutsPanelOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const { undo, redo, canUndo, canRedo, saveState, undoAction, redoAction } = useUndoRedo(
    (components) => setCanvasComponents(components)
  );

  const { queueSave } = useAutoSave({
    caseId,
    onSaveStart: () => setSaveStatus('saving'),
    onSaveComplete: () => setSaveStatus('saved'),
    onSaveError: () => setSaveStatus('error')
  });

  useEffect(() => {
    initializeDemo();
    calculationEngine.setupDefaultDependencies();

    agentOrchestrator.onStreaming((update) => {
      setStreamingUpdate(update);
      if (update.stage === 'complete') {
        setTimeout(() => setStreamingUpdate(null), 1000);
      }
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandBarOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsPanelOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        if (canvasComponents.length > 0) {
          setIsPresentationMode(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasComponents]);

  useEffect(() => {
    if (canvasComponents.length > 0) {
      saveState(canvasComponents, 'Update canvas', 'user');
    }
  }, [canvasComponents, saveState]);

  const initializeDemo = () => {
    const demoComponents: CanvasComponent[] = [
      {
        id: crypto.randomUUID(),
        type: 'metric-card',
        position: { x: 50, y: 50 },
        size: { width: 300, height: 120 },
        props: {
          title: 'Projected ROI',
          value: '245%',
          trend: 'up',
          change: '+12% vs baseline'
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'metric-card',
        position: { x: 400, y: 50 },
        size: { width: 300, height: 120 },
        props: {
          title: 'Payback Period',
          value: '14 Months',
          trend: 'neutral',
          change: 'Within target range'
        }
      }
    ];
    setCanvasComponents(demoComponents);
  };

  const updateComponent = useCallback((id: string, updates: Partial<CanvasComponent>) => {
    const currentComponent = canvasComponents.find(c => c.id === id);
    if (!currentComponent) return;

    const hasValueChange = updates.props && currentComponent.props.value !== updates.props.value;

    setCanvasComponents(prev =>
      prev.map(comp => comp.id === id ? { ...comp, ...updates } : comp)
    );

    if (hasValueChange) {
      const rippleId = `ripple-${Date.now()}`;
      setRippleEffects(prev => [...prev, {
        id: rippleId,
        componentId: id,
        position: { x: currentComponent.position.x + currentComponent.size.width / 2, y: currentComponent.position.y + currentComponent.size.height / 2 }
      }]);

      const deltaId = `delta-${Date.now()}`;
      setDeltaBadges(prev => [...prev, {
        id: deltaId,
        componentId: id,
        oldValue: currentComponent.props.value,
        newValue: updates.props!.value,
        position: { x: currentComponent.position.x + currentComponent.size.width / 2, y: currentComponent.position.y }
      }]);

      const calcUpdates = calculationEngine.calculateCascade(id, canvasComponents);
      if (calcUpdates.length > 0) {
        calcUpdates.forEach(update => {
          setTimeout(() => {
            setCanvasComponents(prev =>
              prev.map(comp => comp.id === update.componentId ? { ...comp, props: { ...comp.props, value: update.newValue } } : comp)
            );
          }, 800);
        });
      }

      setRecentChanges(prev => [...prev, { componentId: id, changeType: 'calculation', timestamp: new Date() }]);
    }

  }, [canvasComponents]);

  const addComponent = useCallback((component: Omit<CanvasComponent, 'id'>, useGhostPreview = false) => {
    if (useGhostPreview) {
      setGhostPreview(component);
    } else {
      const newComponent = {
        ...component,
        id: crypto.randomUUID()
      };
      setCanvasComponents(prev => [...prev, newComponent]);
    }
  }, []);

  const confirmGhostPreview = useCallback((position: { x: number; y: number }) => {
    if (ghostPreview) {
      const newComponent = {
        ...ghostPreview,
        position,
        id: crypto.randomUUID()
      };
      setCanvasComponents(prev => [...prev, newComponent]);
      setGhostPreview(null);
    }
  }, [ghostPreview]);

  const cancelGhostPreview = useCallback(() => {
    setGhostPreview(null);
  }, []);

  const handleAgentQuery = useCallback(async (query: string) => {
    setIsCommandBarOpen(false);
    setStreamingUpdate({
      agent: 'orchestrator',
      action: 'Processing your request...',
      timestamp: new Date()
    });

    try {
      const { agentFabricService } = await import('../../services/AgentFabricService');

      const { canvasComponents: newComponents } = await agentFabricService.generateValueCase(query);

      setCanvasComponents(prev => [...prev, ...newComponents]);

      setStreamingUpdate({
        agent: 'orchestrator',
        action: 'Value case generated successfully!',
        timestamp: new Date()
      });

      setTimeout(() => setStreamingUpdate(null), 3000);
    } catch (error) {
      logger.error('Agent Fabric error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('API key not configured')) {
        setStreamingUpdate({
          agent: 'orchestrator',
          action: `⚠️ ${errorMessage}`,
          timestamp: new Date()
        });

        setTimeout(() => setStreamingUpdate(null), 10000);
        return;
      }

      setStreamingUpdate({
        agent: 'orchestrator',
        action: 'Error occurred. Trying fallback...',
        timestamp: new Date()
      });

      try {
        const response = await agentOrchestrator.processQuery(query, {
          components: canvasComponents,
          selectedComponent
        });

        if (response && response.type === 'component') {
          addComponent(response.payload, true);
        }

        setStreamingUpdate({
          agent: 'orchestrator',
          action: 'Component added using fallback system',
          timestamp: new Date()
        });
      } catch (fallbackError) {
        logger.error('Fallback error:', fallbackError);
        setStreamingUpdate({
          agent: 'orchestrator',
          action: `❌ Error: ${fallbackError instanceof Error ? fallbackError.message : 'Failed to process request'}`,
          timestamp: new Date()
        });
      }

      setTimeout(() => setStreamingUpdate(null), 5000);
    }
  }, [canvasComponents, selectedComponent, addComponent]);

  const handleSuggestionAction = useCallback((suggestionId: string, action: string) => {
    if (action === 'dismiss') {
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    } else {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (suggestion) {
        handleAgentQuery(action);
        setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      }
    }
  }, [suggestions, handleAgentQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const newSuggestions = suggestionEngine.generateSuggestions({
        components: canvasComponents,
        selectedComponent,
        recentChanges
      });

      if (newSuggestions.length > 0) {
        setSuggestions(prev => [...prev, ...newSuggestions]);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [canvasComponents, selectedComponent, recentChanges]);

  const removeRippleEffect = useCallback((id: string) => {
    setRippleEffects(prev => prev.filter(r => r.id !== id));
  }, []);

  const removeDeltaBadge = useCallback((id: string) => {
    setDeltaBadges(prev => prev.filter(d => d.id !== id));
  }, []);

  const removeDependencyLine = useCallback((id: string) => {
    setDependencyLines(prev => prev.filter(l => l.id !== id));
  }, []);
  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <Toolbar onAddComponent={(comp) => addComponent(comp, false)} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    title="Back to library"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Acme Corp - SaaS ROI Analysis</h1>
                  <p className="text-sm text-muted-foreground">Last modified: Today at 2:34 PM</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className={`p-2 rounded-lg transition-colors ${
                      canUndo
                        ? 'text-foreground hover:bg-accent'
                        : 'text-muted-foreground/40 cursor-not-allowed'
                    }`}
                    title={undoAction ? `Undo: ${undoAction}` : 'Nothing to undo'}
                  >
                    <Undo className="h-4 w-4" />

                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className={`p-2 rounded-lg transition-colors ${
                      canRedo
                        ? 'text-foreground hover:bg-accent'
                        : 'text-muted-foreground/40 cursor-not-allowed'
                    }`}
                    title={redoAction ? `Redo: ${redoAction}` : 'Nothing to redo'}

                  >
                    <Redo className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-6 border-l border-border/60"></div>

                <SaveIndicator status={saveStatus} />

                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex items-center px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
                  title="View history"

                >
                  <History className="h-4 w-4 mr-2" />
                  History
                </button>

                <button
                  onClick={() => setIsShortcutsPanelOpen(true)}
                  className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
                  title="Keyboard shortcuts (?)"


                >
                  <HelpCircle className="h-4 w-4" />
                </button>

                <div className="h-6 border-l border-border/60"></div>

                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                  Draft
                </span>
                <button
                  onClick={() => setIsPresentationMode(true)}
                  disabled={canvasComponents.length === 0}
                  className="flex items-center bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-light-blue-sm hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Presentation className="h-4 w-4 mr-2" />
                  Present

                </button>
              </div>
            </div>
          </div>

          <Canvas
            components={canvasComponents}
            selectedComponent={selectedComponent}
            onSelectComponent={setSelectedComponent}
            onUpdateComponent={updateComponent}
            highlightedComponentId={highlightedComponentId}
          />

          {ghostPreview && (
            <GhostPreview
              component={ghostPreview}
              onConfirm={confirmGhostPreview}
              onCancel={cancelGhostPreview}
            />
          )}

          {suggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAction={(action) => handleSuggestionAction(suggestion.id, action)}
              onDismiss={() => handleSuggestionAction(suggestion.id, 'dismiss')}
            />
          ))}

          {streamingUpdate && (
            <StreamingIndicator
              update={streamingUpdate}
              position={{ x: window.innerWidth / 2 - 150, y: 100 }}
            />
          )}

          {rippleEffects.map(ripple => (
            <RippleEffect
              key={ripple.id}
              componentId={ripple.componentId}
              position={ripple.position}
              onComplete={() => removeRippleEffect(ripple.id)}
            />
          ))}

          {deltaBadges.map(badge => (
            <DeltaBadge
              key={badge.id}
              componentId={badge.componentId}
              oldValue={badge.oldValue}
              newValue={badge.newValue}
              position={badge.position}
              onComplete={() => removeDeltaBadge(badge.id)}
            />
          ))}

          {dependencyLines.map(line => (
            <DependencyLine
              key={line.id}
              from={line.from}
              to={line.to}
              onComplete={() => removeDependencyLine(line.id)}
            />
          ))}
        </div>

        <ControlsPanel
          selectedComponent={selectedComponent}
          onUpdateComponent={updateComponent}
        />
      </div>

      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        onSubmit={handleAgentQuery}
      />

      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        caseId={caseId}
        componentId={selectedComponent?.id}
        onHighlightComponent={setHighlightedComponentId}
      />

      <KeyboardShortcutsPanel
        isOpen={isShortcutsPanelOpen}
        onClose={() => setIsShortcutsPanelOpen(false)}
      />

      <PresentationMode
        isOpen={isPresentationMode}
        onClose={() => setIsPresentationMode(false)}
        components={canvasComponents}
        caseName="Acme Corp - SaaS ROI Analysis"
      />

      <div className="fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setIsCommandBarOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-light-blue-sm hover:bg-primary/90 transition-all flex items-center space-x-2"
        >
          <span className="text-sm font-medium">Ask Agent</span>
          <kbd className="px-2 py-0.5 bg-accent text-accent-foreground rounded text-xs">⌘K</kbd>
        </button>
      </div>
    </div>
  );
};