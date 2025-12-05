import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

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
  loading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  requireTypedConfirmation = false,
  confirmationPhrase = 'DELETE',
  isDangerous = false,
  loading = false,
}) => {
  const [typedText, setTypedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      setTimeout(() => {
        if (requireTypedConfirmation && inputRef.current) {
          inputRef.current.focus();
        } else if (modalRef.current) {
          const firstButton = modalRef.current.querySelector('button');
          firstButton?.focus();
        }
      }, 100);
    } else {
      setTypedText('');
      setIsProcessing(false);

      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, requireTypedConfirmation, isProcessing, onClose]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      logger.error('Confirmation action failed:', error);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div
        ref={modalRef}
        className="bg-card text-card-foreground rounded-lg shadow-beautiful-md border border-border max-w-md w-full"
        role="document"
      >
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex items-start space-x-3">
            {isDangerous && (
              <div className="flex-shrink-0 p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
            )}
            <h3
              id="modal-title"
              className="text-lg font-semibold text-foreground"
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground hover:text-accent-foreground"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p
            id="modal-description"
            className="text-muted-foreground"
          >
            {message}
          </p>

          {requireTypedConfirmation && (
            <div>
              <label
                htmlFor="confirmation-input"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Type <strong className={isDangerous ? 'text-red-600' : 'text-foreground'}>
                  {confirmationPhrase}
                </strong> to confirm
              </label>
              <input
                ref={inputRef}
                id="confirmation-input"
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 ${
                  isDangerous
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-border focus:ring-primary'
                }`}
                placeholder={`Type ${confirmationPhrase}`}
                disabled={isProcessing}
                aria-required="true"
                aria-invalid={typedText.length > 0 && !canConfirm}
              />
              {typedText.length > 0 && !canConfirm && (
                <p className="text-sm text-red-600 mt-1" role="alert">
                  The text doesn't match. Please type exactly: {confirmationPhrase}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 px-6 py-4 bg-muted rounded-b-lg">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || isProcessing || loading}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDangerous
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-beautiful-sm'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-light-blue-sm'
            }`}
            aria-busy={isProcessing || loading}
          >
            {(isProcessing || loading) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            )}
            {isProcessing || loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
