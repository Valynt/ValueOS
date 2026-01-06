/**
 * Deal Import Modal
 * 
 * Allows sales reps to import deals from CRM or create manual deals.
 * Entry point for the sales enablement workflow.
 */

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CRMIntegrationService } from '@/services/CRMIntegrationService';
import { ValueCaseService } from '@/services/ValueCaseService';
import { logger } from '@/lib/logger';
import { AlertCircle, Building2, Plus, RefreshCw } from 'lucide-react';
import type { CRMDeal } from '@/mcp-crm/types';
import type { LifecycleStage } from '@/types/vos';

interface DealImportModalProps {
  open: boolean;
  onClose: () => void;
  onDealImported: (dealId: string) => void;
}

export function DealImportModal({ open, onClose, onDealImported }: DealImportModalProps) {
  const [activeTab, setActiveTab] = useState<'crm' | 'manual'>('crm');
  const [crmDeals, setCrmDeals] = useState<CRMDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);

  // Manual deal form state
  const [manualDeal, setManualDeal] = useState({
    companyName: '',
    dealAmount: '',
    stage: 'discovery' as LifecycleStage,
    closeDate: '',
    description: ''
  });

  const crmService = new CRMIntegrationService();
  const valueCaseService = new ValueCaseService();

  useEffect(() => {
    if (open && activeTab === 'crm') {
      loadCRMDeals();
    }
  }, [open, activeTab]);

  const loadCRMDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Implement CRM deal fetching
      // const deals = await crmService.fetchDeals();
      // setCrmDeals(deals);
      
      // Mock data for now
      setCrmDeals([
        {
          id: 'deal-1',
          externalId: 'SF-001',
          provider: 'salesforce',
          name: 'Acme Corp - Enterprise License',
          amount: 250000,
          currency: 'USD',
          stage: 'Proposal',
          probability: 75,
          closeDate: new Date('2026-03-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerName: 'Sarah Johnson',
          companyName: 'Acme Corp',
          properties: {}
        },
        {
          id: 'deal-2',
          externalId: 'SF-002',
          provider: 'salesforce',
          name: 'TechStart Inc - Growth Plan',
          amount: 85000,
          currency: 'USD',
          stage: 'Discovery',
          probability: 40,
          closeDate: new Date('2026-04-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerName: 'Mike Chen',
          companyName: 'TechStart Inc',
          properties: {}
        }
      ]);
    } catch (err) {
      logger.error('Failed to load CRM deals', err as Error);
      setError('Failed to load deals from CRM. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCRMDeal = async () => {
    if (!selectedDeal) return;

    setLoading(true);
    setError(null);

    try {
      const deal = crmDeals.find(d => d.id === selectedDeal);
      if (!deal) throw new Error('Deal not found');

      // Create value case from CRM deal
      const valueCase = await valueCaseService.createValueCase({
        name: deal.name,
        company: deal.companyName || 'Unknown Company',
        description: `Imported from ${deal.provider}: ${deal.externalId}`,
        stage: 'opportunity',
        status: 'in-progress',
        metadata: {
          crmDealId: deal.externalId,
          crmProvider: deal.provider,
          dealAmount: deal.amount,
          closeDate: deal.closeDate,
          probability: deal.probability
        }
      });

      logger.info('CRM deal imported successfully', { valueCaseId: valueCase.id });
      onDealImported(valueCase.id);
      onClose();
    } catch (err) {
      logger.error('Failed to import CRM deal', err as Error);
      setError('Failed to import deal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManualDeal = async () => {
    if (!manualDeal.companyName) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const valueCase = await valueCaseService.createValueCase({
        name: `${manualDeal.companyName} - Business Case`,
        company: manualDeal.companyName,
        description: manualDeal.description,
        stage: manualDeal.stage,
        status: 'in-progress',
        metadata: {
          dealAmount: manualDeal.dealAmount ? parseFloat(manualDeal.dealAmount) : undefined,
          closeDate: manualDeal.closeDate || undefined,
          manualEntry: true
        }
      });

      logger.info('Manual deal created successfully', { valueCaseId: valueCase.id });
      onDealImported(valueCase.id);
      onClose();
    } catch (err) {
      logger.error('Failed to create manual deal', err as Error);
      setError('Failed to create deal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Import or Create Deal
          </DialogTitle>
          <DialogDescription>
            Import a deal from your CRM or create a new opportunity manually
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'crm' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="crm">Import from CRM</TabsTrigger>
            <TabsTrigger value="manual">Create Manually</TabsTrigger>
          </TabsList>

          <TabsContent value="crm" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select a deal from your connected CRM
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCRMDeals}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : crmDeals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No deals found in your CRM</p>
                  <p className="text-sm">Try creating a deal manually instead</p>
                </div>
              ) : (
                crmDeals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedDeal === deal.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{deal.name}</h4>
                        <p className="text-sm text-muted-foreground">{deal.companyName}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Stage: {deal.stage}</span>
                          <span>•</span>
                          <span>Owner: {deal.ownerName}</span>
                          {deal.probability && (
                            <>
                              <span>•</span>
                              <span>{deal.probability}% probability</span>
                            </>
                          )}
                        </div>
                      </div>
                      {deal.amount && (
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            ${deal.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {deal.closeDate && new Date(deal.closeDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImportCRMDeal}
                disabled={!selectedDeal || loading}
              >
                Import Selected Deal
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="e.g., Acme Corporation"
                  value={manualDeal.companyName}
                  onChange={(e) => setManualDeal({ ...manualDeal, companyName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dealAmount">Deal Amount (USD)</Label>
                  <Input
                    id="dealAmount"
                    type="number"
                    placeholder="250000"
                    value={manualDeal.dealAmount}
                    onChange={(e) => setManualDeal({ ...manualDeal, dealAmount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closeDate">Expected Close Date</Label>
                  <Input
                    id="closeDate"
                    type="date"
                    value={manualDeal.closeDate}
                    onChange={(e) => setManualDeal({ ...manualDeal, closeDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stage">Initial Stage</Label>
                <Select
                  value={manualDeal.stage}
                  onValueChange={(value) => setManualDeal({ ...manualDeal, stage: value as LifecycleStage })}
                >
                  <SelectTrigger id="stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opportunity">Discovery</SelectItem>
                    <SelectItem value="target">Modeling</SelectItem>
                    <SelectItem value="realization">Realization</SelectItem>
                    <SelectItem value="expansion">Expansion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the opportunity"
                  value={manualDeal.description}
                  onChange={(e) => setManualDeal({ ...manualDeal, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateManualDeal}
                disabled={!manualDeal.companyName || loading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Deal
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
