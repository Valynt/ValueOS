/**
 * Configuration Diff Viewer Component
 * 
 * Compare configurations and show differences
 */

'use client';

import { ArrowRight, Download, GitCompare } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface ConfigurationSnapshot {
  id: string;
  timestamp: Date;
  label: string;
  configuration: Record<string, unknown>;
}

interface DiffEntry {
  path: string;
  category: string;
  setting: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

interface ConfigurationDiffViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentConfiguration: Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not set';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function formatSettingName(setting: string): string {
  return setting
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function calculateDiff(oldConfig: Record<string, unknown>, newConfig: Record<string, unknown>): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const categories = new Set([
    ...Object.keys(oldConfig || {}),
    ...Object.keys(newConfig || {})
  ]);

  categories.forEach(category => {
    const oldCat = oldConfig?.[category] || {};
    const newCat = newConfig?.[category] || {};
    const settings = new Set([
      ...Object.keys(oldCat),
      ...Object.keys(newCat)
    ]);

    settings.forEach(setting => {
      const oldValue = oldCat[setting];
      const newValue = newCat[setting];
      
      let changeType: DiffEntry['changeType'] = 'unchanged';
      if (oldValue === undefined && newValue !== undefined) {
        changeType = 'added';
      } else if (oldValue !== undefined && newValue === undefined) {
        changeType = 'removed';
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changeType = 'modified';
      }

      if (changeType !== 'unchanged') {
        diffs.push({
          path: `${category}.${setting}`,
          category,
          setting,
          oldValue,
          newValue,
          changeType
        });
      }
    });
  });

  return diffs;
}

export function ConfigurationDiffViewer({
  open,
  onOpenChange,
  organizationId,
  currentConfiguration
}: ConfigurationDiffViewerProps) {
  const [snapshots, setSnapshots] = useState<ConfigurationSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSnapshots();
    }
  }, [open, organizationId]);

  useEffect(() => {
    if (selectedSnapshotId && currentConfiguration) {
      const snapshot = snapshots.find(s => s.id === selectedSnapshotId);
      if (snapshot) {
        const calculatedDiffs = calculateDiff(snapshot.configuration, currentConfiguration);
        setDiffs(calculatedDiffs);
      }
    }
  }, [selectedSnapshotId, currentConfiguration, snapshots]);

  const fetchSnapshots = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/configurations/snapshots?organizationId=${organizationId}&limit=10`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch snapshots');
      }

      const data = await response.json();
      const snapshotList = data.snapshots || [];
      setSnapshots(snapshotList);
      
      if (snapshotList.length > 0) {
        setSelectedSnapshotId(snapshotList[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  const exportDiff = () => {
    const diffReport = {
      timestamp: new Date().toISOString(),
      organizationId,
      comparison: {
        from: snapshots.find(s => s.id === selectedSnapshotId)?.label,
        to: 'Current'
      },
      changes: diffs
    };

    const blob = new Blob([JSON.stringify(diffReport, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-diff-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Configuration Diff Viewer
          </DialogTitle>
          <DialogDescription>
            Compare current configuration with previous versions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Comparison Selector */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Compare from:</label>
              <Select
                value={selectedSnapshotId}
                onValueChange={setSelectedSnapshotId}
                disabled={loading || snapshots.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a version" />
                </SelectTrigger>
                <SelectContent>
                  {snapshots.map(snapshot => (
                    <SelectItem key={snapshot.id} value={snapshot.id}>
                      {snapshot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" />

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">To:</label>
              <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                <span className="text-sm">Current Configuration</span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          {diffs.length > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportDiff}>
                <Download className="mr-2 h-4 w-4" />
                Export Diff Report
              </Button>
            </div>
          )}

          {/* Diff Display */}
          <ScrollArea className="h-[400px] border rounded-md p-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No previous versions available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Configuration snapshots will appear here after changes
                </p>
              </div>
            ) : diffs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground">No differences found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The configurations are identical
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  diffs.reduce((acc, diff) => {
                    if (!acc[diff.category]) acc[diff.category] = [];
                    acc[diff.category].push(diff);
                    return acc;
                  }, {} as Record<string, DiffEntry[]>)
                ).map(([category, categoryDiffs]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-semibold text-lg capitalize">
                      {category.replace(/_/g, ' ')}
                    </h3>
                    {categoryDiffs.map((diff, idx) => (
                      <div
                        key={idx}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {formatSettingName(diff.setting)}
                          </span>
                          <Badge
                            variant={
                              diff.changeType === 'added'
                                ? 'default'
                                : diff.changeType === 'removed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {diff.changeType}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              Previous:
                            </span>
                            <div className="font-mono bg-muted px-3 py-2 rounded border">
                              {diff.changeType === 'added' ? (
                                <span className="text-muted-foreground italic">
                                  Not set
                                </span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">
                                  {formatValue(diff.oldValue)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-muted-foreground block mb-1">
                              Current:
                            </span>
                            <div className="font-mono bg-muted px-3 py-2 rounded border">
                              {diff.changeType === 'removed' ? (
                                <span className="text-muted-foreground italic">
                                  Removed
                                </span>
                              ) : (
                                <span className="text-green-600 dark:text-green-400">
                                  {formatValue(diff.newValue)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
