/**
 * FE-027: Finalize State UI
 *
 * Confirmation panel shown after all artifacts are reviewed.
 * Displays a summary of approved artifacts and persists results.
 */

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Download,
  Share2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Artifact } from "../../agent/types";

interface FinalizePanelProps {
  artifacts: Artifact[];
  onExport: () => void;
  onShare: () => void;
  onDone: () => void;
}

export function FinalizePanel({
  artifacts,
  onExport,
  onShare,
  onDone,
}: FinalizePanelProps) {
  const [saving, setSaving] = useState(true);

  const approved = artifacts.filter((a) => a.status === "approved");
  const rejected = artifacts.filter((a) => a.status === "rejected");

  // Simulate persistence delay
  useEffect(() => {
    const timer = setTimeout(() => setSaving(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className="border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-2">
        {saving ? (
          <Loader2 size={16} className="text-emerald-600 animate-spin" />
        ) : (
          <Sparkles size={16} className="text-emerald-600" />
        )}
        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
          {saving ? "Saving Results..." : "Analysis Complete"}
        </span>
      </div>

      {/* Success message */}
      <div className="p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          {saving ? (
            <Loader2 size={24} className="text-emerald-600 animate-spin" />
          ) : (
            <CheckCircle2 size={24} className="text-emerald-600" />
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">
          {saving ? "Persisting artifacts..." : "Value case updated"}
        </h3>
        <p className="text-sm text-slate-500">
          {approved.length} artifact{approved.length !== 1 ? "s" : ""} approved
          {rejected.length > 0 && `, ${rejected.length} rejected`}
        </p>
      </div>

      {/* Artifact summary */}
      {!saving && approved.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
            {approved.map((artifact) => (
              <div key={artifact.id} className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span className="text-xs text-slate-600 truncate">{artifact.title}</span>
                <Badge className="ml-auto text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
                  Saved
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!saving && (
        <div className="px-4 py-3 border-t border-slate-100 space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="flex-1"
            >
              <Download size={14} className="mr-1.5" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="flex-1"
            >
              <Share2 size={14} className="mr-1.5" />
              Share
            </Button>
          </div>
          <Button
            size="sm"
            onClick={onDone}
            className="w-full"
          >
            Done
          </Button>
        </div>
      )}
    </Card>
  );
}
