import React, { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle, Cloud } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveIndicatorProps {
  status: SaveStatus;
  errorMessage?: string;
  className?: string;
}

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({
  status,
  errorMessage,
  className = '',
}) => {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'idle' && !showSaved) {
    return null;
  }

  const getStatusConfig = () => {
    if (showSaved || status === 'saved') {
      return {
        icon: <Check className="h-4 w-4" aria-hidden="true" />,
        text: 'Saved',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        ariaLive: 'polite' as const,
      };
    }

    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
          text: 'Saving...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          ariaLive: 'polite' as const,
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
          text: errorMessage || 'Save failed',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          ariaLive: 'assertive' as const,
        };
      default:
        return {
          icon: <Cloud className="h-4 w-4" aria-hidden="true" />,
          text: 'All changes saved',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          ariaLive: 'polite' as const,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg ${config.bgColor} ${config.color} text-sm ${className}`}
      role="status"
      aria-live={config.ariaLive}
      aria-atomic="true"
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};

export const useAutoSave = (
  saveFunction: () => Promise<void>,
  delay: number = 2000
): {
  status: SaveStatus;
  triggerSave: () => void;
  errorMessage?: string;
} => {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>();

  const triggerSave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setStatus('saving');

    const id = setTimeout(async () => {
      try {
        await saveFunction();
        setStatus('saved');
        setErrorMessage(undefined);
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save');
      }
    }, delay);

    setTimeoutId(id);
  };

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return { status, triggerSave, errorMessage };
};
