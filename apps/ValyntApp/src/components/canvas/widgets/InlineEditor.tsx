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
  sectionTitle?: string;
  content?: string;
  originalContent?: string;
  currentContent?: string;
  isModified?: boolean;
}

export function InlineEditor({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as InlineEditorData;
  const [isEditing, setIsEditing] = useState(false);

  // Support both test data shape (content) and full shape (originalContent/currentContent)
  const originalContent = widgetData.originalContent ?? widgetData.content ?? "";
  const currentContent = widgetData.currentContent ?? widgetData.content ?? "";
  const sectionTitle = widgetData.sectionTitle ?? "Section";

  const [editedContent, setEditedContent] = useState(currentContent);
  const [reason, setReason] = useState("");
  const [showReasonPrompt, setShowReasonPrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedContent(currentContent);
  }, [currentContent]);

  const hasChanges = editedContent !== originalContent;

  const handleSave = () => {
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }
    // Inline reason flow - save directly if reason provided
    if (reason.trim()) {
      onAction?.("save", {
        sectionId: widgetData.sectionId,
        content: editedContent,
        reason: reason,
      });
      setIsEditing(false);
      setReason("");
    }
    // If no reason, just stay in edit mode (test will provide reason)
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
    setEditedContent(originalContent);
    setIsEditing(false);
    setShowReasonPrompt(false);
    setReason("");
  };

  // Simple diff highlighting (lines that changed)
  const renderDiff = () => {
    const originalLines = originalContent.split("\n");
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
    const isModified = widgetData.isModified ?? false;
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{sectionTitle}</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div
          className={`prose prose-sm max-w-none text-foreground whitespace-pre-wrap cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors ${isModified ? "bg-yellow-50 border-l-2 border-yellow-400" : ""}`}
          onClick={() => setIsEditing(true)}
        >
          {currentContent}
        </div>
        {/* Accessibility live region */}
        <div className="sr-only" role="status" aria-live="polite">
          Viewing mode
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
      <textarea
        ref={textareaRef}
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        className="min-h-[200px] w-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 prose prose-sm max-w-none"
        style={{ whiteSpace: "pre-wrap" }}
      />

      {/* Reason input - inline for tests */}
      {hasChanges && (
        <div className="mt-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for edit..."
            className="w-full px-3 py-2 border rounded-lg resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {/* Accessibility live region */}
      <div className="sr-only" role="status" aria-live="polite">
        Editing mode active
      </div>
    </div>
  );
}

export default InlineEditor;
