/**
 * ExportHistoryPanel
 *
 * Displays export history for a value case with download links,
 * refresh capability, and quality indicators.
 *
 * @task P1 - Export History & Asset Management Dashboard
 */

import { Download, FileSpreadsheet, FileText, RefreshCw, File } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExportHistory, useRefreshExportUrl, type ExportHistoryItem } from "@/hooks/useExportJobs";
import { formatBytes } from "@/lib/utils";

interface ExportHistoryPanelProps {
  caseId: string | undefined;
}

export function ExportHistoryPanel({ caseId }: ExportHistoryPanelProps) {
  const { data: exports, isLoading, error } = useExportHistory(caseId, 10);
  const refreshUrl = useRefreshExportUrl(caseId);

  const handleRefresh = async (jobId: string) => {
    try {
      const result = await refreshUrl.mutateAsync({ jobId });
      // Open the refreshed URL
      if (result.signedUrl) {
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Error handled by mutation
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription className="text-red-600">
            Failed to load export history
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!exports || exports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Export History
          </CardTitle>
          <CardDescription>
            No exports yet. Generate your first export to see it here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5" />
          Recent Exports
        </CardTitle>
        <CardDescription>
          {exports.length} export{exports.length !== 1 ? "s" : ""} available
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Format</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exports.map((exportItem) => (
              <ExportRow
                key={exportItem.id}
                exportItem={exportItem}
                onRefresh={() => handleRefresh(exportItem.id)}
                onDownload={() =>
                  exportItem.signedUrl && handleDownload(exportItem.signedUrl)
                }
                isRefreshing={refreshUrl.isPending}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface ExportRowProps {
  exportItem: ExportHistoryItem;
  onRefresh: () => void;
  onDownload: () => void;
  isRefreshing: boolean;
}

function ExportRow({ exportItem, onRefresh, onDownload, isRefreshing }: ExportRowProps) {
  const formatIcon =
    exportItem.format === "pdf" ? (
      <FileText className="h-4 w-4 text-red-500" />
    ) : (
      <FileSpreadsheet className="h-4 w-4 text-blue-500" />
    );

  const formatLabel = exportItem.format === "pdf" ? "PDF" : "PPTX";
  const exportTypeLabel = getExportTypeLabel(exportItem.exportType);

  // Check if URL is expired or expiring soon (within 5 minutes)
  const isUrlExpired =
    !exportItem.signedUrlExpiresAt ||
    new Date(exportItem.signedUrlExpiresAt) < new Date();

  const isUrlExpiringSoon =
    exportItem.signedUrlExpiresAt &&
    new Date(exportItem.signedUrlExpiresAt) < new Date(Date.now() + 5 * 60 * 1000) &&
    !isUrlExpired;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {formatIcon}
          <div>
            <div className="font-medium">{formatLabel}</div>
            <div className="text-xs text-muted-foreground">{exportTypeLabel}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {new Date(exportItem.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {exportItem.fileSizeBytes ? formatBytes(exportItem.fileSizeBytes) : "—"}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {exportItem.integrityScoreAtExport !== null && (
            <QualityBadge score={exportItem.integrityScoreAtExport} />
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {isUrlExpiringSoon && (
            <span className="text-xs text-amber-600">Expiring soon</span>
          )}
          {isUrlExpired ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing..." : "Refresh Link"}
            </Button>
          ) : exportItem.signedUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Link unavailable</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function getExportTypeLabel(exportType: string): string {
  const labels: Record<string, string> = {
    full: "Full Proposal",
    executive_summary: "Executive Summary Only",
    financials_only: "Financials Only",
    hypotheses_only: "Hypotheses Only",
  };
  return labels[exportType] ?? exportType;
}

function QualityBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  let variant: "green" | "amber" | "red" = "green";
  let label = "Good";

  if (percentage < 60) {
    variant = "red";
    label = "Low";
  } else if (percentage < 80) {
    variant = "amber";
    label = "Fair";
  }

  const colorClasses = {
    green: "bg-green-100 text-green-700 border-green-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    red: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses[variant]}`}
      title={`Integrity score at export: ${percentage}%`}
    >
      {label} ({percentage}%)
    </span>
  );
}
