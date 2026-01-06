import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  customerAccessService,
  type CustomerAccessToken,
} from "@/services/CustomerAccessService";
import { useToast } from "@/components/Common/Toast";
import { logger } from "@/lib/logger";

interface CustomerAccessTableProps {
  tokens: CustomerAccessToken[];
  valueCaseId: string;
  userId: string;
  onRefresh: () => Promise<void>;
}

const TOKEN_MASK_MIN_LENGTH = 10;
const TOKEN_MASK_PREFIX_LENGTH = 6;
const TOKEN_MASK_SUFFIX_LENGTH = 4;
const DEFAULT_EXPIRES_IN_DAYS = 90;
const MAX_EXPIRES_IN_DAYS = 365;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function maskToken(token: string): string {
  if (token.length <= TOKEN_MASK_MIN_LENGTH) return token;
  return `${token.slice(0, TOKEN_MASK_PREFIX_LENGTH)}…${token.slice(-TOKEN_MASK_SUFFIX_LENGTH)}`;
}

export function CustomerAccessTable({
  tokens,
  valueCaseId,
  userId,
  onRefresh,
}: CustomerAccessTableProps) {
  const toast = useToast();
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState("90");

  const expiresInDaysValue = useMemo(() => {
    const parsed = Number(expiresInDays);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_EXPIRES_IN_DAYS;
    return Math.min(MAX_EXPIRES_IN_DAYS, Math.floor(parsed));
  }, [expiresInDays]);

  const handleRevoke = async (token: string): Promise<void> => {
    setBusyToken(token);
    try {
      const success = await customerAccessService.revokeCustomerToken(
        token,
        userId,
        "Revoked from admin"
      );
      if (success) {
        toast.success("Token revoked");
      } else {
        toast.warning(
          "Token not revoked",
          "Token not found or already revoked."
        );
      }
      await onRefresh();
    } catch (error) {
      logger.error("Failed to revoke token", error as Error);
      toast.error("Revoke failed", "Unable to revoke token.");
    } finally {
      setBusyToken(null);
    }
  };

  const handleRegenerate = async (oldToken: string): Promise<void> => {
    setBusyToken(oldToken);
    try {
      const result = await customerAccessService.regenerateToken(
        oldToken,
        userId,
        valueCaseId,
        expiresInDaysValue
      );
      toast.success(
        "Token regenerated",
        "A new portal link has been created.",
        {
          label: "Copy link",
          onClick: () => void navigator.clipboard.writeText(result.portal_url),
        }
      );
      await onRefresh();
    } catch (error) {
      logger.error("Failed to regenerate token", error as Error);
      toast.error("Regenerate failed", "Unable to regenerate token.");
    } finally {
      setBusyToken(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Customer Access Tokens</h2>
          <p className="text-sm text-muted-foreground">
            Manage customer portal access for this value case.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={MAX_EXPIRES_IN_DAYS}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            className="w-28"
          />
          <Button
            variant="outline"
            onClick={() => void onRefresh()}
            disabled={busyToken !== null}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-3 font-medium">Token</th>
              <th className="py-2 pr-3 font-medium">Created</th>
              <th className="py-2 pr-3 font-medium">Expires</th>
              <th className="py-2 pr-3 font-medium">Last Access</th>
              <th className="py-2 pr-3 font-medium">Access Count</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-0 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-6 text-center text-muted-foreground"
                >
                  No tokens found.
                </td>
              </tr>
            ) : (
              tokens.map((row) => {
                const isRevoked = row.revoked_at !== null;
                const status = isRevoked
                  ? "revoked"
                  : new Date(row.expires_at).getTime() < Date.now()
                    ? "expired"
                    : "active";

                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3 font-mono">
                      {maskToken(row.token)}
                    </td>
                    <td className="py-3 pr-3">{formatDate(row.created_at)}</td>
                    <td className="py-3 pr-3">{formatDate(row.expires_at)}</td>
                    <td className="py-3 pr-3">
                      {formatDate(row.last_accessed_at)}
                    </td>
                    <td className="py-3 pr-3">{row.access_count}</td>
                    <td className="py-3 pr-3">{status}</td>
                    <td className="py-3 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void navigator.clipboard.writeText(
                              customerAccessService.getPortalUrl(row.token)
                            )
                          }
                          disabled={busyToken !== null}
                        >
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRegenerate(row.token)}
                          disabled={busyToken !== null}
                        >
                          Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRevoke(row.token)}
                          disabled={busyToken !== null || status !== "active"}
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
