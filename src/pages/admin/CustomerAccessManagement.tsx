import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ValueCase, valueCaseService } from "@/services/ValueCaseService";
import {
  customerAccessService,
  type CustomerAccessToken,
} from "@/services/CustomerAccessService";
import { CustomerAccessTable } from "@/components/admin/CustomerAccessTable";
import { useAuth } from "@/app/providers/AuthContext";
import { useToast } from "@/components/Common/Toast";
import { logger } from "@/lib/logger";

export function CustomerAccessManagement() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [valueCases, setValueCases] = useState<ValueCase[]>([]);
  const [selectedValueCaseId, setSelectedValueCaseId] = useState<string | null>(
    null
  );
  const [tokens, setTokens] = useState<CustomerAccessToken[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const selectedValueCase = useMemo(
    () => valueCases.find((vc) => vc.id === selectedValueCaseId) || null,
    [selectedValueCaseId, valueCases]
  );

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!user) return;

      setLoading(true);
      try {
        const deals = await valueCaseService.getValueCases();
        setValueCases(deals);
        if (deals.length > 0) {
          setSelectedValueCaseId((prev) => prev || deals[0].id);
        }
      } catch (error) {
        logger.error(
          "Failed to load value cases for customer access management",
          error as Error
        );
        toast.error("Load failed", "Unable to load deals.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [toast, user]);

  const refreshTokens = useCallback(async (): Promise<void> => {
    if (!selectedValueCaseId) return;

    setRefreshing(true);
    try {
      const result =
        await customerAccessService.getTokensForValueCase(selectedValueCaseId);
      setTokens(result);
    } catch (error) {
      logger.error("Failed to load customer access tokens", error as Error);
      toast.error("Load failed", "Unable to fetch customer tokens.");
    } finally {
      setRefreshing(false);
    }
  }, [selectedValueCaseId, toast]);

  useEffect(() => {
    void refreshTokens();
  }, [refreshTokens]);

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Customer Access Management</h1>
            <p className="text-sm text-muted-foreground">
              View and manage customer portal tokens.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void refreshTokens()}
            disabled={refreshing || loading}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Value case</p>
            <Select
              value={selectedValueCaseId || undefined}
              onValueChange={(v) => setSelectedValueCaseId(v)}
              disabled={loading || valueCases.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loading ? "Loading…" : "Select a value case"}
                />
              </SelectTrigger>
              <SelectContent>
                {valueCases.map((vc) => (
                  <SelectItem key={vc.id} value={vc.id}>
                    {vc.company} — {vc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedValueCase && (
            <CustomerAccessTable
              tokens={tokens}
              valueCaseId={selectedValueCase.id}
              userId={user.id}
              onRefresh={refreshTokens}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
