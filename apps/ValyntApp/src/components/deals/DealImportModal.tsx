/**
 * DealImportModal Component (Refined)
 *
 * Creating a new Deal from within ValueOS (if permission allows).
 * Role Constraint: Only available to Closer role.
 *
 * Features:
 * - Create Deal in CRM (optional)
 * - Auto-fill amount from Case Value Model
 */

import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';

import type { Deal } from './DealStatusCapsule';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


export interface DealImportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when deal is created/imported */
  onDealImported: (dealId: string) => void;
  /** Pre-filled company name from Value Case */
  companyName?: string;
  /** Pre-filled amount from Value Model */
  suggestedAmount?: number;
  /** Whether the user has Closer role */
  isCloser?: boolean;
  /** Available CRM integrations */
  availableCRMs?: Array<'salesforce' | 'hubspot' | 'pipedrive'>;
}

const CRM_LABELS: Record<string, string> = {
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  pipedrive: 'Pipedrive',
};

const STAGE_OPTIONS: Array<{ value: Deal['stage']; label: string }> = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
];

export function DealImportModal({
  open,
  onClose,
  onDealImported,
  companyName = '',
  suggestedAmount,
  isCloser = false,
  availableCRMs = ['salesforce', 'hubspot'],
}: DealImportModalProps) {
  const [dealName, setDealName] = useState('');
  const [company, setCompany] = useState(companyName);
  const [amount, setAmount] = useState(suggestedAmount?.toString() || '');
  const [stage, setStage] = useState<Deal['stage']>('qualification');
  const [closeDate, setCloseDate] = useState('');
  const [selectedCRM, setSelectedCRM] = useState<string | null>(null);
  const [syncToCRM, setSyncToCRM] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setDealName('');
      setCompany(companyName);
      setAmount(suggestedAmount?.toString() || '');
      setStage('qualification');
      setCloseDate('');
      setSelectedCRM(availableCRMs[0] || null);
      setSyncToCRM(false);
      setError(null);
    }
  }, [open, companyName, suggestedAmount, availableCRMs]);

  const handleSubmit = useCallback(async () => {
    if (!dealName.trim()) {
      setError('Deal name is required');
      return;
    }
    if (!company.trim()) {
      setError('Company name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate a mock deal ID
      const newDealId = `deal-${Date.now()}`;

      // In a real implementation, this would:
      // 1. Create the deal in the local database
      // 2. If syncToCRM is true, also create in the selected CRM
      // 3. Return the deal ID

      onDealImported(newDealId);
      onClose();
    } catch (err) {
      setError('Failed to create deal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [dealName, company, onDealImported, onClose]);

  // Role check
  if (!isCloser) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Closer Role Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Only users with the Closer role can create new deals.
                    Please contact your sales manager for assistance.
                  </p>
                </div>
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogDescription>
            Create a new deal and optionally sync it to your CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Deal Name */}
          <div className="space-y-2">
            <Label htmlFor="deal-name">Deal Name *</Label>
            <Input
              id="deal-name"
              placeholder="e.g., Acme Corp Q2 Expansion"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
            />
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="company"
                placeholder="Company name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Amount and Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              {suggestedAmount && (
                <p className="text-xs text-muted-foreground">
                  Suggested from Value Model: ${suggestedAmount.toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as Deal['stage'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Close Date */}
          <div className="space-y-2">
            <Label htmlFor="close-date">Expected Close Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="close-date"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* CRM Sync */}
          {availableCRMs.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="sync-crm"
                  checked={syncToCRM}
                  onCheckedChange={(checked) => setSyncToCRM(checked === true)}
                />
                <Label htmlFor="sync-crm" className="font-medium">
                  Create in CRM
                </Label>
              </div>

              {syncToCRM && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="crm-select">Select CRM</Label>
                  <Select
                    value={selectedCRM || undefined}
                    onValueChange={setSelectedCRM}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select CRM" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCRMs.map((crm) => (
                        <SelectItem key={crm} value={crm}>
                          {CRM_LABELS[crm]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Deal will be created in {selectedCRM ? CRM_LABELS[selectedCRM] : 'selected CRM'}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Create Deal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
