/**
 * ShareCustomerButton Component
 *
 * Button to share the Value Case with a customer via a secure link.
 * Creates a customer access token and provides a shareable URL.
 */

import React, { useState, useCallback } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  Mail,
  Loader2,
  AlertCircle,
  Clock,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ValueCase } from '@/services/ValueCaseService';

export interface ShareCustomerButtonProps {
  /** The value case to share */
  valueCase: ValueCase;
  /** Current user ID for tracking */
  userId: string;
  /** Callback when share is created */
  onShareCreated?: (shareUrl: string) => void;
}

interface ShareLink {
  id: string;
  url: string;
  expiresAt: Date;
  accessCount: number;
  maxAccess?: number;
}

type ExpirationOption = '24h' | '7d' | '30d' | 'never';

const EXPIRATION_LABELS: Record<ExpirationOption, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  'never': 'Never expires',
};

function getExpirationDate(option: ExpirationOption): Date | null {
  const now = new Date();
  switch (option) {
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case 'never':
      return null;
  }
}

export function ShareCustomerButton({
  valueCase,
  userId,
  onShareCreated,
}: ShareCustomerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiration, setExpiration] = useState<ExpirationOption>('7d');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createShareLink = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Simulate API call to create share link
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const expiresAt = getExpirationDate(expiration);
      const token = Math.random().toString(36).substring(2, 15);
      const shareUrl = `${window.location.origin}/customer/portal?token=${token}`;

      const link: ShareLink = {
        id: `share-${Date.now()}`,
        url: shareUrl,
        expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        accessCount: 0,
        maxAccess: undefined,
      };

      setShareLink(link);
      onShareCreated?.(shareUrl);
    } catch (err) {
      setError('Failed to create share link. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [expiration, onShareCreated]);

  const copyToClipboard = useCallback(async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  }, [shareLink]);

  const sendEmail = useCallback(async () => {
    if (!shareLink || !recipientEmail) return;

    // Open email client with pre-filled content
    const subject = encodeURIComponent(`Value Realization Dashboard - ${valueCase.company}`);
    const body = encodeURIComponent(
      `Hello,\n\nI'd like to share our Value Realization Dashboard with you.\n\nAccess it here: ${shareLink.url}\n\nBest regards`
    );
    window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`);
  }, [shareLink, recipientEmail, valueCase.company]);

  const handleClose = () => {
    setIsOpen(false);
    // Reset state after animation
    setTimeout(() => {
      setShareLink(null);
      setRecipientEmail('');
      setError(null);
    }, 200);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsOpen(true)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Create Share Link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Mail className="w-4 h-4 mr-2" />
            Email Report (Coming Soon)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Share with Customer</DialogTitle>
            <DialogDescription>
              Create a secure link to share the Value Realization Dashboard with your customer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!shareLink ? (
              <>
                {/* Expiration Selection */}
                <div className="space-y-2">
                  <Label htmlFor="expiration">Link Expiration</Label>
                  <Select
                    value={expiration}
                    onValueChange={(v) => setExpiration(v as ExpirationOption)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select expiration" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXPIRATION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Security Info */}
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Secure Access</p>
                      <p className="text-sm text-blue-700 mt-1">
                        The link provides read-only access to the Value Realization Dashboard.
                        Customer data is protected and access is logged.
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Share Link Created */}
                <Card className="p-4 bg-green-50 border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Link Created</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={shareLink.url}
                      readOnly
                      className="bg-white"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyToClipboard}
                      className={cn(copied && 'bg-green-100 border-green-300')}
                      aria-label={copied ? "Copied" : "Copy share link"}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                      ) : (
                        <Copy className="w-4 h-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </Card>

                {/* Link Details */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>
                      Expires: {shareLink.expiresAt.toLocaleDateString()}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {shareLink.accessCount} views
                  </Badge>
                </div>

                {/* Email Option */}
                <div className="space-y-2">
                  <Label htmlFor="email">Send via Email (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      type="email"
                      placeholder="customer@company.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={sendEmail}
                      disabled={!recipientEmail}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {shareLink ? 'Done' : 'Cancel'}
            </Button>
            {!shareLink && (
              <Button onClick={createShareLink} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Create Link
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
