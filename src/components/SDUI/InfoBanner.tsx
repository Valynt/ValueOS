import React from 'react';
import { AlertCircle, Info, ShieldCheck } from 'lucide-react';

export type InfoBannerTone = 'info' | 'warning' | 'success';

export interface InfoBannerProps {
  title: string;
  description?: string;
  tone?: InfoBannerTone;
}

const toneIconMap: Record<InfoBannerTone, React.ReactNode> = {
  info: <Info className="h-5 w-5" aria-hidden="true" />,
  warning: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
  success: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
};

const toneClassMap: Record<InfoBannerTone, string> = {
  info: 'bg-blue-50 text-blue-900 border-blue-200',
  warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
};

export const InfoBanner: React.FC<InfoBannerProps> = ({
  title,
  description,
  tone = 'info',
}) => {
  const Icon = toneIconMap[tone];

  return (
    <div
      className={`flex items-start space-x-3 rounded-lg border px-4 py-3 shadow-sm ${toneClassMap[tone]}`}
      role="alert"
      aria-live="polite"
      data-testid="info-banner"
    >
      <div className="mt-0.5 text-current" aria-hidden="true">
        {Icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold leading-6">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-current/80 leading-5">{description}</p>
        )}
      </div>
    </div>
  );
};
