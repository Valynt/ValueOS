/**
 * InlineConfidenceEditor Component
 *
 * Allows direct editing of confidence scores with visual feedback.
 * Shows score as percentage with slider and optional reason input.
 */

import { Check, ChevronDown, TrendingUp } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ConfidenceBadge } from "@valueos/components/components/ConfidenceBadge";

export interface InlineConfidenceEditorProps {
  /** Current confidence score (0-1) */
  score: number;
  /** Callback when score is updated */
  onUpdate: (score: number, reason?: string) => void | Promise<void>;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Require reason for changes above threshold */
  requireReasonThreshold?: number;
  /** Whether update is in progress */
  isUpdating?: boolean;
}

const SIZE_MAP = {
  sm: { badge: "text-xs", button: "h-6 px-2 text-xs", popover: "w-64" },
  md: { badge: "text-sm", button: "h-8 px-3 text-sm", popover: "w-72" },
  lg: { badge: "text-base", button: "h-10 px-4", popover: "w-80" },
};

export function InlineConfidenceEditor({
  score,
  onUpdate,
  disabled = false,
  size = "md",
  showTooltip = true,
  requireReasonThreshold = 0.15,
  isUpdating = false,
}: InlineConfidenceEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftScore, setDraftScore] = useState(Math.round(score * 100));
  const [reason, setReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = SIZE_MAP[size];

  useEffect(() => {
    if (isOpen) {
      setDraftScore(Math.round(score * 100));
      setReason("");
      setShowReasonInput(false);
    }
  }, [isOpen, score]);

  const handleSliderChange = useCallback((values: number[]) => {
    const newScore = values[0];
    if (typeof newScore !== "number") return;
    setDraftScore(newScore);
    const delta = Math.abs(newScore / 100 - score);
    if (delta > requireReasonThreshold * 100) {
      setShowReasonInput(true);
    }
  }, [score, requireReasonThreshold]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setDraftScore(value);
      const delta = Math.abs(value / 100 - score);
      if (delta > requireReasonThreshold * 100) {
        setShowReasonInput(true);
      }
    }
  }, [score, requireReasonThreshold]);

  const handleConfirm = useCallback(async () => {
    const newScore = draftScore / 100;
    await onUpdate(newScore, reason || undefined);
    setIsOpen(false);
  }, [draftScore, reason, onUpdate]);

  const delta = Math.abs(draftScore / 100 - score);
  const requiresReason = delta > requireReasonThreshold;
  const canConfirm = !requiresReason || reason.trim().length > 0;

  return (
    <DropdownMenu open={isOpen && !disabled} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled || isUpdating}
          className={`inline-flex items-center gap-1.5 ${sizeClasses.badge} font-medium rounded-full px-2.5 py-0.5 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${score >= 0.75
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : score >= 0.5
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              : "bg-red-100 text-red-800 hover:bg-red-200"
            }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          {Math.round(score * 100)}%
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={`${sizeClasses.popover} p-4`} align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Edit Confidence</h4>
            <ConfidenceBadge score={draftScore / 100} showTooltip={false} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Slider
                value={[draftScore]}
                onValueChange={handleSliderChange}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <div className="flex items-center gap-1">
                <Input
                  ref={inputRef}
                  type="number"
                  min={0}
                  max={100}
                  value={draftScore}
                  onChange={handleInputChange}
                  className="w-16 h-8 text-center"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            {delta > 0 && (
              <p className="text-xs text-muted-foreground">
                Change: {delta > 0 ? "+" : ""}
                {Math.round(delta * 100)}% from {Math.round(score * 100)}%
              </p>
            )}
          </div>

          {(showReasonInput || requiresReason) && (
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Reason for change {requiresReason && <span className="text-red-500">*</span>}
              </label>
              <Input
                placeholder="e.g., New evidence from customer call..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Changes over {Math.round(requireReasonThreshold * 100)}% require a reason
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!canConfirm || isUpdating}
              className="h-8"
            >
              <Check className="w-4 h-4 mr-1" />
              {isUpdating ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default InlineConfidenceEditor;
