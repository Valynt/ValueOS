/**
 * Configuration Templates Dialog
 * 
 * Apply pre-defined templates for quick setup
 */

'use client';

import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { type ConfigurationTemplate, configurationTemplates } from '@/lib/configuration-templates';

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onTemplateApplied: () => void;
}

export function TemplatesDialog({
  open,
  onOpenChange,
  organizationId,
  onTemplateApplied
}: TemplatesDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ConfigurationTemplate | null>(null);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setApplying(true);

      const response = await fetch('/api/admin/configurations/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          templateId: selectedTemplate.id,
          configuration: selectedTemplate.configuration
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to apply template');
      }

      toast({
        title: 'Template applied',
        description: `${selectedTemplate.name} template has been successfully applied`
      });

      setSelectedTemplate(null);
      onTemplateApplied();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Failed to apply template',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setApplying(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'startup':
        return 'bg-blue-500';
      case 'enterprise':
        return 'bg-purple-500';
      case 'development':
        return 'bg-green-500';
      case 'production':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Configuration Templates
          </DialogTitle>
          <DialogDescription>
            Choose a pre-configured template to quickly set up your organization
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="grid grid-cols-2 gap-4">
            {configurationTemplates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'ring-2 ring-primary'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {template.name}
                        <Badge
                          className={`${getCategoryColor(template.category)} text-white`}
                        >
                          {template.category}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {template.description}
                      </CardDescription>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Users:</span>
                      <span className="font-medium">
                        {template.configuration.organization.tenantProvisioning.maxUsers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage:</span>
                      <span className="font-medium">
                        {template.configuration.organization.tenantProvisioning.maxStorageGB} GB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Budget:</span>
                      <span className="font-medium">
                        ${template.configuration.ai.llmSpendingLimits.monthlyHardCap}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Model:</span>
                      <span className="font-medium">
                        {template.configuration.ai.modelRouting.defaultModel}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {selectedTemplate && (
          <div className="space-y-4 pt-4 border-t">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Applying this template will replace your current configuration. Make sure to export your current settings first if you want to keep a backup.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedTemplate(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyTemplate}
                disabled={applying}
                className="flex-1"
              >
                {applying ? (
                  <>Applying...</>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply {selectedTemplate.name} Template
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
