/**
 * InlineEditor Widget
 *
 * contentEditable region with save/cancel, diff highlight on modified sections, reason prompt on save.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.4
 */

import { Edit3, Save, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { WidgetProps } from "../CanvasHost";

export interface InlineEditorData {
  sectionId: string;
  sectionTitle: string;
  originalContent: string;
  currentContent: string;
}

export function InlineEditor({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as InlineEditorData;
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(widgetData.currentContent);
  const [reason, setReason] = useState("");
  const [showReasonPrompt, setShowReasonPrompt] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedContent(widgetData.currentContent);
  }, [widgetData.currentContent]);

  const hasChanges = editedContent !== widgetData.originalContent;

  const handleSave = () => {
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }
    setShowReasonPrompt(true);
  };

  const handleConfirmSave = () => {
    if (!reason.trim()) return;

    onAction?.("save", {
      sectionId: widgetData.sectionId,
      content: editedContent,
      reason: reason,
    });

    setShowReasonPrompt(false);
    setIsEditing(false);
    setReason("");
  };

  const handleCancel = () => {
    setEditedContent(widgetData.originalContent);
    setIsEditing(false);
    setShowReasonPrompt(false);
    setReason("");
  };

  // Simple diff highlighting (lines that changed)
  const renderDiff = () => {
    const originalLines = widgetData.originalContent.split("\n");
    const editedLines = editedContent.split("\n");

    return editedLines.map((line, index) => {
      const isChanged = line !== originalLines[index];
      return (
        <div
          key={index}
          className={`px-2 py-0.5 ${isChanged ? "bg-yellow-50 border-l-2 border-yellow-400" : ""}`}
        >
          {line || "\u00A0"}
        </div>
      );
    });
  };

  if (!isEditing) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{widgetData.sectionTitle}</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
          {widgetData.currentContent}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{widgetData.sectionTitle}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {/* Diff view */}
      {hasChanges && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800 font-medium mb-2">Changes detected:</p>
          <div className="text-sm font-mono whitespace-pre-wrap">{renderDiff()}</div>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={(e) => setEditedContent(e.currentTarget.textContent || "")}
        className="min-h-[200px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 prose prose-sm max-w-none"
        style={{ whiteSpace: "pre-wrap" }}
        suppressContentEditableWarning
      >
        {editedContent}
      </div>

      {/* Reason prompt modal */}
      {showReasonPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h4 className="font-semibold mb-2">Save Changes</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Please provide a reason for this edit. This will be recorded in the audit trail.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for edit..."
              className="w-full px-3 py-2 border rounded-lg resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowReasonPrompt(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={!reason.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accessibility live region */}
      <div className="sr-only" aria-live="polite">
        {isEditing ? "Editing mode active" : "Viewing mode"}
      </div>
    </div>
  );
}

export default InlineEditor;
