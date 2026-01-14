/**
 * Export/Import Configuration Dialog
 * 
 * Backup and restore configurations
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, AlertCircle, CheckCircle2, FileJson } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ExportImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentConfiguration: any;
  onImportComplete: () => void;
}

export function ExportImportDialog({
  open,
  onOpenChange,
  organizationId,
  currentConfiguration,
  onImportComplete
}: ExportImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      organizationId,
      configuration: currentConfiguration,
      metadata: {
        exportedBy: 'admin',
        environment: 'production'
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${organizationId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Configuration exported',
      description: 'Configuration file downloaded successfully'
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.configuration || !data.version) {
        throw new Error('Invalid configuration file format');
      }

      setImportFile(file);
      setImportPreview(data);
    } catch (error) {
      toast({
        title: 'Invalid file',
        description: error instanceof Error ? error.message : 'Failed to parse configuration file',
        variant: 'destructive'
      });
      event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!importPreview) return;

    try {
      setImporting(true);

      const response = await fetch('/api/admin/configurations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          configuration: importPreview.configuration
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to import configuration');
      }

      toast({
        title: 'Configuration imported',
        description: 'Configuration has been successfully imported'
      });

      setImportPreview(null);
      setImportFile(null);
      onImportComplete();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import configuration',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  const calculateChanges = () => {
    if (!importPreview) return { added: 0, modified: 0, removed: 0 };

    let added = 0, modified = 0, removed = 0;

    const compareObjects = (current: any, imported: any, path = '') => {
      const currentKeys = new Set(Object.keys(current || {}));
      const importedKeys = new Set(Object.keys(imported || {}));

      importedKeys.forEach(key => {
        if (!currentKeys.has(key)) {
          added++;
        } else if (JSON.stringify(current[key]) !== JSON.stringify(imported[key])) {
          modified++;
        }
      });

      currentKeys.forEach(key => {
        if (!importedKeys.has(key)) {
          removed++;
        }
      });
    };

    compareObjects(currentConfiguration, importPreview.configuration);

    return { added, modified, removed };
  };

  const changes = importPreview ? calculateChanges() : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Export / Import Configuration
          </DialogTitle>
          <DialogDescription>
            Backup or restore your organization configuration
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <Alert>
              <Download className="h-4 w-4" />
              <AlertDescription>
                Export your current configuration as a JSON file for backup or migration purposes.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">What will be exported:</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>All organization settings</li>
                <li>All AI configuration</li>
                <li>Metadata and timestamps</li>
              </ul>
            </div>

            <Button onClick={handleExport} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Export Configuration
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertDescription>
                Import a previously exported configuration file. This will replace your current settings.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="config-file"
                  className="block text-sm font-medium mb-2"
                >
                  Select Configuration File
                </label>
                <input
                  id="config-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    cursor-pointer"
                />
              </div>

              {importPreview && changes && (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-2">Preview Changes:</div>
                      <div className="flex gap-4 text-sm">
                        {changes.added > 0 && (
                          <Badge variant="default">
                            +{changes.added} Added
                          </Badge>
                        )}
                        {changes.modified > 0 && (
                          <Badge variant="secondary">
                            ~{changes.modified} Modified
                          </Badge>
                        )}
                        {changes.removed > 0 && (
                          <Badge variant="destructive">
                            -{changes.removed} Removed
                          </Badge>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="bg-muted p-4 rounded-md">
                    <div className="text-sm space-y-1">
                      <div><strong>File:</strong> {importFile?.name}</div>
                      <div><strong>Version:</strong> {importPreview.version}</div>
                      <div><strong>Exported:</strong> {new Date(importPreview.exportedAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This will replace your current configuration. Make sure to export your current settings first if you want to keep a backup.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setImportPreview(null);
                        setImportFile(null);
                        const input = document.getElementById('config-file') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={importing}
                      className="flex-1"
                    >
                      {importing ? (
                        <>Importing...</>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Import Configuration
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
