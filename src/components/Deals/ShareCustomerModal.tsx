import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerAccessService } from "@/services/CustomerAccessService";
import { useToast } from "@/components/Common/Toast";
import { logger } from "@/lib/logger";
import type { ValueCase } from "@/services/ValueCaseService";

interface ShareCustomerModalProps {
  open: boolean;
  onClose: () => void;
  valueCase: ValueCase;
  revokedByUserId: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ShareCustomerModal({
  open,
  onClose,
  valueCase,
  revokedByUserId,
}: ShareCustomerModalProps) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [loading, setLoading] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  const expiresInDaysValue = useMemo(() => {
    const parsed = Number(expiresInDays);
    if (!Number.isFinite(parsed) || parsed <= 0) return 90;
    return Math.min(365, Math.floor(parsed));
  }, [expiresInDays]);

  const canSend = useMemo(
    () => isValidEmail(email) && !loading,
    [email, loading]
  );

  const handleGenerateAndSend = async (): Promise<void> => {
    if (!isValidEmail(email)) {
      toast.error("Invalid email", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const tokenResult = await customerAccessService.generateCustomerToken(
        valueCase.id,
        expiresInDaysValue
      );
      setPortalUrl(tokenResult.portal_url);

      await customerAccessService.sendPortalAccessEmail(
        email,
        valueCase.company,
        tokenResult.portal_url
      );

      toast.success(
        "Portal link generated",
        `Access link created for ${email}.`
      );
    } catch (error) {
      logger.error("Failed to share customer portal", error as Error);
      toast.error("Share failed", "Unable to generate portal access.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeMostRecent = async (): Promise<void> => {
    if (!portalUrl) return;

    setLoading(true);
    try {
      const activeTokens =
        await customerAccessService.getActiveTokensForValueCase(valueCase.id);
      const mostRecent = activeTokens[0];
      if (!mostRecent) {
        toast.warning(
          "No active tokens",
          "There are no active customer tokens to revoke."
        );
        return;
      }

      await customerAccessService.revokeCustomerToken(
        mostRecent.token,
        revokedByUserId,
        "Revoked from share modal"
      );
      toast.success("Token revoked", "Customer access token revoked.");
      setPortalUrl(null);
    } catch (error) {
      logger.error("Failed to revoke token", error as Error);
      toast.error("Revoke failed", "Unable to revoke customer token.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (): Promise<void> => {
    if (!portalUrl) return;

    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success("Copied", "Portal link copied to clipboard.");
    } catch {
      toast.error("Copy failed", "Could not copy link to clipboard.");
    }
  };

  const handleClose = (): void => {
    setLoading(false);
    setPortalUrl(null);
    setEmail("");
    setExpiresInDays("90");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share with Customer</DialogTitle>
          <DialogDescription>
            Generate a secure portal link for {valueCase.company} and send it to
            a customer contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-email">Customer email</Label>
            <Input
              id="customer-email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires-days">Expires in (days)</Label>
            <Input
              id="expires-days"
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              disabled={loading}
            />
          </div>

          {portalUrl && (
            <div className="space-y-2">
              <Label>Portal link</Label>
              <div className="flex gap-2">
                <Input value={portalUrl} readOnly />
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  disabled={loading}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {portalUrl ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleRevokeMostRecent}
                  disabled={loading}
                >
                  Revoke
                </Button>
                <Button onClick={handleGenerateAndSend} disabled={!canSend}>
                  Regenerate & Send
                </Button>
              </>
            ) : (
              <Button onClick={handleGenerateAndSend} disabled={!canSend}>
                {loading ? "Generating…" : "Generate & Send"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
