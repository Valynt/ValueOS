import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface UnknownComponentFallbackProps {
  componentName: string;
  reason?: string;
}

export const UnknownComponentFallback: React.FC<UnknownComponentFallbackProps> = ({
  componentName,
  reason,
}) => (
  <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-amber-900" role="alert">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Component unavailable: {componentName}</p>
        <p className="text-sm text-amber-800">
          {reason || 'The registry could not resolve this SDUI component. Rendering a safe placeholder instead.'}
        </p>
      </div>
    </div>
  </div>
);
