import React from 'react';
import { Bug } from 'lucide-react';

interface SectionErrorFallbackProps {
  componentName: string;
}

export const SectionErrorFallback: React.FC<SectionErrorFallbackProps> = ({ componentName }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
    <div className="flex items-start gap-3">
      <Bug className="h-5 w-5 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Component failed to render</p>
        <p className="text-sm text-red-800">{componentName} encountered a runtime error. A safe fallback was rendered.</p>
      </div>
    </div>
  </div>
);
