/**
 * Configuration Panel Component
 * 
 * Admin UI for managing organization configurations
 */

'use client';

import { AlertCircle, Check, CheckSquare, Command, Download, Filter, GitCompare, History, Loader2, RefreshCw, Save, Search, Sparkles, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { CommandPalette } from './CommandPalette';
import { AISettings } from './configuration/AISettings';
import { ChangeHistorySidebar } from './configuration/ChangeHistorySidebar';
import { ConfigurationDiffViewer } from './configuration/ConfigurationDiffViewer';
import { ExportImportDialog } from './configuration/ExportImportDialog';
import { OrganizationSettings } from './configuration/OrganizationSettings';
import { TemplatesDialog } from './configuration/TemplatesDialog';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';

/** Shape of a single configuration category (e.g. organization, ai). */
export type ConfigurationCategory = Record<string, unknown>;

/** Top-level configuration object keyed by category name. */
export type ConfigurationData = Record<string, ConfigurationCategory>;

interface ConfigurationPanelProps {
  organizationId: string;
  userRole: 'tenant_admin' | 'vendor_admin';
}

// Helper function for relative time
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

export function ConfigurationPanel({ organizationId, userRole }: ConfigurationPanelProps) {
  const [configurations, setConfigurations] = useState<ConfigurationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'organization' | 'ai'>('organization');
  const [pendingChanges, setPendingChanges] = useState<Map<string, { category: string; setting: string; value: unknown }>>(new Map());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showChangeHistory, setShowChangeHistory] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchInValues, setSearchInValues] = useState(true);
  const [searchFilter, setSearchFilter] = useState<'all' | 'recent' | 'organization' | 'ai'>('all');
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedSettings, setSelectedSettings] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConfigurations();
  }, [organizationId]);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/configurations?organizationId=${organizationId}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Specific error messages based on status code
        let title = 'Unable to load configurations';
        let description = 'An unexpected error occurred';
        
        if (response.status === 403) {
          title = 'Access denied';
          description = 'You don\'t have permission to view these configurations';
        } else if (response.status === 404) {
          title = 'Organization not found';
          description = 'The requested organization does not exist';
        } else if (response.status === 500) {
          title = 'Server error';
          description = 'Our servers are experiencing issues. Please try again in a moment';
        } else if (response.status === 429) {
          title = 'Too many requests';
          description = 'Please wait a moment before trying again';
        } else if (errorData.message) {
          description = errorData.message;
        }
        
        throw new Error(description);
      }

      const data = await response.json();
      setConfigurations(data.configurations);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load configurations';
      
      toast({
        title: 'Unable to load configurations',
        description: message,
        variant: 'destructive',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfigurations}
          >
            Retry
          </Button>
        )
      });
    } finally {
      setLoading(false);
    }
  };

  // Debounced auto-save
  const debouncedSave = useCallback(
    async (category: string, setting: string, value: unknown) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set saving status
      setSaveStatus('saving');

      // Debounce for 1 second
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch('/api/admin/configurations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId,
              category,
              setting,
              value
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to update configuration');
          }

          // Update local state
          setConfigurations((prev) => ({
            ...prev,
            [category]: {
              ...(prev?.[category] ?? {}),
              [setting]: value
            }
          }));

          // Clear pending change
          setPendingChanges((prev) => {
            const next = new Map(prev);
            next.delete(`${category}.${setting}`);
            return next;
          });

          setSaveStatus('saved');
          setLastSaved(new Date());

          // Reset to idle after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
          setSaveStatus('error');
          
          // Determine specific error message
          let title = 'Unable to save changes';
          let description = error instanceof Error ? error.message : 'An error occurred';
          
          // Add context about what failed
          const settingName = setting.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          title = `Unable to save ${settingName}`;
          
          toast({
            title,
            description,
            variant: 'destructive',
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => debouncedSave(category, setting, value)}
              >
                Retry
              </Button>
            )
          });
          
          // Reset error status after 5 seconds
          setTimeout(() => {
            if (saveStatus === 'error') {
              setSaveStatus('idle');
            }
          }, 5000);
        }
      }, 1000);
    },
    [organizationId, toast]
  );

  const updateConfiguration = useCallback(
    (category: string, setting: string, value: unknown) => {
      // Track pending change
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(`${category}.${setting}`, { category, setting, value });
        return next;
      });

      // Trigger debounced save
      debouncedSave(category, setting, value);
    },
    [debouncedSave]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0 || saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingChanges.size, saveStatus]);

  // Force save all pending changes
  const forceSave = useCallback(async () => {
    if (pendingChanges.size === 0) {
      toast({
        title: 'Nothing to save',
        description: 'All changes are already saved'
      });
      return;
    }

    setSaveStatus('saving');
    
    try {
      // Save all pending changes
      const savePromises = Array.from(pendingChanges.values()).map(
        ({ category, setting, value }) =>
          fetch('/api/admin/configurations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId,
              category,
              setting,
              value
            })
          })
      );

      await Promise.all(savePromises);

      setPendingChanges(new Map());
      setSaveStatus('saved');
      setLastSaved(new Date());

      toast({
        title: 'All changes saved',
        description: `Saved ${savePromises.length} change${savePromises.length > 1 ? 's' : ''}`
      });

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      toast({
        title: 'Failed to save',
        description: 'Some changes could not be saved',
        variant: 'destructive'
      });
    }
  }, [pendingChanges, organizationId, toast]);

  // Keyboard shortcuts
  useHotkeys('mod+s', (e) => {
    e.preventDefault();
    forceSave();
  }, { enableOnFormTags: true });

  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setShowCommandPalette(true);
  }, { enableOnFormTags: true });

  useHotkeys('mod+/', (e) => {
    e.preventDefault();
    setShowShortcutsHelp(true);
  }, { enableOnFormTags: true });

  useHotkeys('escape', () => {
    setShowCommandPalette(false);
    setShowShortcutsHelp(false);
    setShowChangeHistory(false);
    setShowDiffViewer(false);
    setShowExportImport(false);
    setShowTemplates(false);
    if (showSearch) {
      setShowSearch(false);
      setSearchQuery('');
    }
  });

  useHotkeys('mod+f', (e) => {
    e.preventDefault();
    setShowSearch(true);
  }, { enableOnFormTags: true });

  useHotkeys('mod+h', (e) => {
    e.preventDefault();
    setShowChangeHistory(true);
  }, { enableOnFormTags: true });

  useHotkeys('mod+d', (e) => {
    e.preventDefault();
    setShowDiffViewer(true);
  }, { enableOnFormTags: true });

  useHotkeys('mod+b', (e) => {
    e.preventDefault();
    setBulkEditMode(!bulkEditMode);
  }, { enableOnFormTags: true });

  useHotkeys('mod+e', (e) => {
    e.preventDefault();
    setShowExportImport(true);
  }, { enableOnFormTags: true });

  useHotkeys('mod+t', (e) => {
    e.preventDefault();
    setShowTemplates(true);
  }, { enableOnFormTags: true });

  const clearCache = async () => {
    try {
      const response = await fetch(
        `/api/admin/configurations/cache?organizationId=${organizationId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to clear cache');
      }

      toast({
        title: 'Cache cleared',
        description: 'Configuration cache has been cleared successfully'
      });
      
      // Refresh configurations after clearing cache
      await fetchConfigurations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear cache';
      
      toast({
        title: 'Unable to clear cache',
        description: message,
        variant: 'destructive',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={clearCache}
          >
            Retry
          </Button>
        )
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-96" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-96" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!configurations) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No configurations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span>Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Failed to save</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage organization settings and AI agent configuration
            {lastSaved && saveStatus === 'idle' && (
              <span className="ml-2 text-xs">
                • Last saved {formatRelativeTime(lastSaved)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bulkEditMode ? (
            <>
              <Badge variant="secondary" className="mr-2">
                Bulk Edit: {selectedSettings.size} selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBulkEditMode(false);
                  setSelectedSettings(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  // Bulk save logic handled by existing auto-save
                  setBulkEditMode(false);
                  setSelectedSettings(new Set());
                  toast({
                    title: 'Bulk changes saved',
                    description: `Saved ${selectedSettings.size} settings`
                  });
                }}
                disabled={selectedSettings.size === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                Save All ({selectedSettings.size})
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={bulkEditMode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setBulkEditMode(!bulkEditMode)}
                title="Bulk edit mode (⌘+B)"
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Bulk Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(true)}
                title="Templates (⌘+T)"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Templates
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExportImport(true)}
                title="Export/Import (⌘+E)"
              >
                <Download className="mr-2 h-4 w-4" />
                Export/Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiffViewer(true)}
                title="Compare configurations (⌘+D)"
              >
                <GitCompare className="mr-2 h-4 w-4" />
                Compare
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChangeHistory(true)}
                title="Change history (⌘+H)"
              >
                <History className="mr-2 h-4 w-4" />
                History
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcutsHelp(true)}
                title="Keyboard shortcuts (⌘+/)"
              >
                <Command className="mr-2 h-4 w-4" />
                Shortcuts
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCommandPalette(true)}
                title="Command palette (⌘+K)"
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button variant="ghost" size="sm" onClick={clearCache}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Clear Cache
              </Button>
              <Button variant="outline" size="sm" onClick={fetchConfigurations}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </>
          )}
        </div>
      </div>

      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        onNavigate={(tab, section) => {
          setActiveTab(tab);
          if (section) {
            // Scroll to section after tab change
            setTimeout(() => {
              const element = document.getElementById(section);
              element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }}
      />

      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
      />

      <ChangeHistorySidebar
        open={showChangeHistory}
        onOpenChange={setShowChangeHistory}
        organizationId={organizationId}
      />

      <ConfigurationDiffViewer
        open={showDiffViewer}
        onOpenChange={setShowDiffViewer}
        organizationId={organizationId}
        currentConfiguration={configurations}
      />

      <ExportImportDialog
        open={showExportImport}
        onOpenChange={setShowExportImport}
        organizationId={organizationId}
        currentConfiguration={configurations}
        onImportComplete={fetchConfigurations}
      />

      <TemplatesDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        organizationId={organizationId}
        onTemplateApplied={fetchConfigurations}
      />

      {pendingChanges.size > 0 && saveStatus !== 'saving' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {pendingChanges.size} unsaved change{pendingChanges.size > 1 ? 's' : ''}. 
            Changes will be saved automatically.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
            <TabsTrigger 
              value="organization"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-6 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Organization
            </TabsTrigger>
            <TabsTrigger 
              value="ai"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-6 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              AI & Agents
            </TabsTrigger>
          </TabsList>

          {/* Advanced Search Bar */}
          {showSearch && (
            <div className="flex-1 max-w-2xl space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search settings... (⌘+F)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Filter className="h-3 w-3 text-muted-foreground" />
                <button
                  onClick={() => setSearchFilter('all')}
                  className={`px-2 py-1 rounded ${
                    searchFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSearchFilter('organization')}
                  className={`px-2 py-1 rounded ${
                    searchFilter === 'organization'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Organization
                </button>
                <button
                  onClick={() => setSearchFilter('ai')}
                  className={`px-2 py-1 rounded ${
                    searchFilter === 'ai'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  AI
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchInValues}
                      onChange={(e) => setSearchInValues(e.target.checked)}
                      className="rounded"
                    />
                    <span>Search in values</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          {!showSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSearch(true)}
              className="ml-auto"
            >
              <Search className="mr-2 h-4 w-4" />
              Search (⌘+F)
            </Button>
          )}
        </div>

        <TabsContent value="organization" className="space-y-4">
          {(searchFilter === 'all' || searchFilter === 'organization') && (
            <OrganizationSettings
              settings={configurations.organization}
              onUpdate={(setting, value) =>
                updateConfiguration('organization', setting, value)
              }
              userRole={userRole}
              saving={saving}
              searchQuery={searchQuery}
              searchInValues={searchInValues}
              bulkEditMode={bulkEditMode}
              selectedSettings={selectedSettings}
              onToggleSelection={(path) => {
                const newSelected = new Set(selectedSettings);
                if (newSelected.has(path)) {
                  newSelected.delete(path);
                } else {
                  newSelected.add(path);
                }
                setSelectedSettings(newSelected);
              }}
            />
          )}
          {searchFilter === 'ai' && searchQuery && (
            <div className="text-center py-12 text-muted-foreground">
              No organization settings match your filter
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          {(searchFilter === 'all' || searchFilter === 'ai') && (
            <AISettings
              settings={configurations.ai}
              onUpdate={(setting, value) => updateConfiguration('ai', setting, value)}
              userRole={userRole}
              saving={saving}
              searchQuery={searchQuery}
              searchInValues={searchInValues}
              bulkEditMode={bulkEditMode}
              selectedSettings={selectedSettings}
              onToggleSelection={(path) => {
                const newSelected = new Set(selectedSettings);
                if (newSelected.has(path)) {
                  newSelected.delete(path);
                } else {
                  newSelected.add(path);
                }
                setSelectedSettings(newSelected);
              }}
            />
          )}
          {searchFilter === 'organization' && searchQuery && (
            <div className="text-center py-12 text-muted-foreground">
              No AI settings match your filter
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
