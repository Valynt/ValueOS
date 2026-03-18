import React, { useState, useRef, useEffect } from "react";

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Escapes HTML entities to ensure content is treated as text.
 */
function sanitizeHtmlContent(content: string): string {
  const div = document.createElement("div");
  div.textContent = content;
  return div.innerHTML;
}

export interface InlineEditorProps {
  initialContent: string;
  onSave: (content: string, reason: string) => void;
  onCancel?: () => void;
  sectionId?: string;
  className?: string;
}

/**
 * InlineEditor - contentEditable region with save/cancel and diff highlight.
 *
 * Shows diff highlight on modified sections, prompts for reason on save.
 *
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.4.2
 */
export function InlineEditor({
  initialContent,
  onSave,
  onCancel,
  sectionId,
  className = "",
}: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [reason, setReason] = useState("");
  const [showReasonPrompt, setShowReasonPrompt] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (!showReasonPrompt) {
      setShowReasonPrompt(true);
      return;
    }

    if (reason.trim()) {
      onSave(content, reason);
      setIsEditing(false);
      setShowReasonPrompt(false);
      setReason("");
    }
  };

  const handleCancel = () => {
    setContent(initialContent);
    setIsEditing(false);
    setShowReasonPrompt(false);
    setReason("");
    onCancel?.();
  };

  const hasChanges = content !== initialContent;

  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        className={`group cursor-pointer hover:bg-accent/30 p-2 -m-2 rounded transition-colors ${className}`}
      >
        <div className="whitespace-pre-wrap">{initialContent}</div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground mt-1">
          Click to edit
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-primary rounded-lg overflow-hidden ${className}`}>
      {/* Editor Toolbar */}
      <div className="px-3 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between">
        <span className="text-xs font-medium text-primary">Editing{sectionId ? ` ${sectionId}` : ""}</span>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-accent/50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="p-3">
        <div
          ref={editorRef}
          contentEditable
          onInput={(e) => setContent(e.currentTarget.textContent || "")}
          className="min-h-[100px] whitespace-pre-wrap outline-none"
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(content) }}
        />

        {/* Diff Indicator */}
        {hasChanges && (
          <div className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
            <span>⚠</span>
            <span>Content modified - diff will be highlighted</span>
          </div>
        )}
      </div>

      {/* Reason Prompt Modal */}
      {showReasonPrompt && (
        <div className="p-3 bg-accent border-t border-border">
          <label className="block text-sm font-medium mb-2">
            Why are you making this edit?
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Updated with latest customer data..."
            className="w-full px-3 py-2 text-sm border border-border rounded mb-3"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowReasonPrompt(false)}
              className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent/50"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={!reason.trim()}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              Confirm Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
