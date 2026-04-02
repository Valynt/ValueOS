import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  requireTypedConfirmation?: boolean;
  confirmationPhrase?: string;
  isDangerous?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  requireTypedConfirmation = false,
  confirmationPhrase = "DELETE",
  isDangerous = false,
}: ConfirmationModalProps) {
  const [typedText, setTypedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element to restore focus on close
      const previousFocus = document.activeElement as HTMLElement | null;

      const timer = setTimeout(() => {
        if (requireTypedConfirmation && inputRef.current) {
          inputRef.current.focus();
        } else {
          // Focus the confirm button by default for keyboard accessibility
          const confirmButton = modalRef.current?.querySelector('[data-confirm-button]') as HTMLElement;
          confirmButton?.focus();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        // Restore focus when modal closes
        previousFocus?.focus();
      };
    } else {
      setTypedText("");
      setIsProcessing(false);
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessing) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, requireTypedConfirmation, isProcessing, onClose]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      logger.error("Confirmation action failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const canConfirm = requireTypedConfirmation
    ? typedText === confirmationPhrase
    : true;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-card text-card-foreground rounded-lg shadow-lg border max-w-md w-full"
      >
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex items-start gap-3">
            {isDangerous && (
              <div className="flex-shrink-0 p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle
                  className="h-6 w-6 text-destructive"
                  aria-hidden="true"
                />
              </div>
            )}
            <h3 id="modal-title" className="text-lg font-semibold">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-muted-foreground">{message}</p>

          {requireTypedConfirmation && (
            <div className="space-y-2">
              <Label htmlFor="confirmation-input">
                Type{" "}
                <strong className={isDangerous ? "text-destructive" : ""}>
                  {confirmationPhrase}
                </strong>{" "}
                to confirm
              </Label>
              <Input
                ref={inputRef}
                id="confirmation-input"
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={`Type ${confirmationPhrase}`}
                disabled={isProcessing}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-muted/50 rounded-b-lg">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant={isDangerous ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canConfirm || isProcessing}
            data-confirm-button
          >
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isProcessing ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
