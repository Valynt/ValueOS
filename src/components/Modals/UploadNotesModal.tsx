/**
 * Upload Notes Modal
 *
 * Allows users to upload or paste opportunity notes (PDF, DOCX, TXT, or raw text).
 * Extracts content and creates a value case with AI-generated insights.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  documentParserService,
  ExtractedInsights,
} from "../../services/DocumentParserService";

interface UploadNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (notes: ExtractedNotes) => void;
  initialFile?: File | null;
}

export interface ExtractedNotes {
  rawText: string;
  fileName?: string;
  fileType?: string;
  insights?: ExtractedInsights;
}

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

export const UploadNotesModal: React.FC<UploadNotesModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialFile,
}) => {
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [pastedText, setPastedText] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedInitialFileKey = useRef<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
    ];

    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(pdf|docx?|txt|md)$/i)
    ) {
      setError("Please upload a PDF, Word document, or text file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be under 10MB");
      return;
    }

    setFile(file);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleSubmit = async () => {
    setError(null);

    let textContent = "";
    let fileName: string | undefined;
    let fileType: string | undefined;
    let insights: ExtractedInsights | undefined;

    if (activeTab === "paste") {
      if (!pastedText.trim()) {
        setError("Please paste some text");
        return;
      }
      textContent = pastedText.trim();

      setUploadState("processing");

      try {
        // Use LLM to extract insights from pasted text
        insights = await documentParserService.extractInsights(textContent);
      } catch (err) {
        console.error("Insight extraction failed:", err);
        // Continue without insights if extraction fails
      }
    } else {
      if (!file) {
        setError("Please select a file");
        return;
      }

      setUploadState("uploading");
      fileName = file.name;
      fileType = file.type;

      try {
        // Parse document and extract insights using the service
        const result = await documentParserService.parseAndExtract(file);
        textContent = result.document.text;
        insights = result.insights;

        setUploadState("processing");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to process document"
        );
        setUploadState("error");
        return;
      }
    }

    setUploadState("success");

    // Small delay to show success state
    setTimeout(() => {
      onComplete({
        rawText: textContent,
        fileName,
        fileType,
        insights,
      });
    }, 500);
  };

  const resetState = () => {
    setFile(null);
    setPastedText("");
    setUploadState("idle");
    setError(null);
    setActiveTab("upload");
    appliedInitialFileKey.current = null;
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  useEffect(() => {
    if (!isOpen || !initialFile) return;

    const fileKey = `${initialFile.name}-${initialFile.size}-${initialFile.lastModified}`;
    if (appliedInitialFileKey.current === fileKey) return;

    handleFileSelect(initialFile);
    appliedInitialFileKey.current = fileKey;
  }, [isOpen, initialFile, handleFileSelect]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-vc-2 bg-popover/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-notes-title"
    >
      <div className="bg-popover rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-vc-2 border-b border-border">
          <div className="flex items-center gap-vc-2">
            <div className="w-vc-3 h-vc-3 bg-muted rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-foreground">
                Upload Notes
              </h2>
              <p className="text-sm text-muted-foreground">
                Import opportunity notes or meeting summaries
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-vc-1 hover:bg-card rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 px-vc-3 py-vc-2 text-sm font-medium transition-colors ${
              activeTab === "upload"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setActiveTab("paste")}
            className={`flex-1 px-vc-3 py-vc-2 text-sm font-medium transition-colors ${
              activeTab === "paste"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Paste Text
          </button>
        </div>

        {/* Content */}
        <div className="p-vc-3">
          {activeTab === "upload" ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-vc-4 text-center transition-all
                ${
                  dragOver
                    ? "border-success bg-success/10"
                    : "border-border hover:border-border"
                }
                ${file ? "bg-card/50" : ""}
              `}
            >
              {file ? (
                <div className="space-y-3">
                  <div className="w-vc-3 h-vc-3 bg-success/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-vc-3 h-vc-3 bg-card rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      Drop your file here
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                      or click to browse
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Supports PDF, Word (.docx), and text files up to 10MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={(e) =>
                      e.target.files?.[0] && handleFileSelect(e.target.files[0])
                    }
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-vc-3 py-vc-1 bg-card text-foreground rounded-lg hover:bg-card/90 transition-colors"
                    aria-label="Choose file to upload"
                  >
                    Choose File
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your meeting notes, call summary, or opportunity details here..."
                className="w-full h-64 px-vc-3 py-vc-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
              <p className="text-gray-500 text-xs">
                {pastedText.length} characters
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-vc-2 border-t border-border">
          <p className="text-muted-foreground text-sm">
            AI will extract key insights automatically
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-vc-3 py-vc-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cancel upload"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                uploadState === "uploading" || uploadState === "processing"
              }
              aria-busy={
                uploadState === "uploading" || uploadState === "processing"
              }
              aria-label={
                uploadState === "uploading"
                  ? "Uploading file"
                  : uploadState === "processing"
                    ? "Analyzing notes"
                    : "Analyze notes"
              }
              className="px-vc-4 py-vc-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {uploadState === "uploading" && (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Uploading...
                </>
              )}
              {uploadState === "processing" && (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Analyzing...
                </>
              )}
              {uploadState === "success" && (
                <>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  Done!
                </>
              )}
              {(uploadState === "idle" || uploadState === "error") &&
                "Analyze Notes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadNotesModal;
