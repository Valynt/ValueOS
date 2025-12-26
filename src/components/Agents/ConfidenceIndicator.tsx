import { Info } from 'lucide-react';

interface ConfidenceIndicatorProps {
  value: number;
  confidence: number;
  label?: string;
  showBar?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ConfidenceIndicator({
  value,
  confidence,
  label,
  showBar = true,
  size = 'md'
}: ConfidenceIndicatorProps) {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 90) return { bg: 'bg-green-500', text: 'text-green-500', fill: 'bg-green-500' };
    if (conf >= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-500', fill: 'bg-yellow-500' };
    return { bg: 'bg-red-500', text: 'text-red-500', fill: 'bg-red-500' };
  };

  const colors = getConfidenceColor(confidence);

  const sizeClasses = {
    sm: { value: 'text-lg', label: 'text-[10px]', bar: 'h-1' },
    md: { value: 'text-2xl', label: 'text-xs', bar: 'h-1.5' },
    lg: { value: 'text-3xl', label: 'text-sm', bar: 'h-2' }
  };

  const classes = sizeClasses[size];

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className={`font-bold text-foreground ${classes.value}`}>{value}</span>
        {label && <span className={`text-muted-foreground ${classes.label}`}>{label}</span>}
      </div>

      {showBar && (
        <div className="flex items-center gap-2">
          <div className={`flex-1 bg-secondary rounded-full ${classes.bar} overflow-hidden`}>
            <div
              className={`${colors.fill} h-full rounded-full transition-all duration-500`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className={`${classes.label} font-medium ${colors.text}`}>
              {confidence}%
            </span>
            <div className="group relative">
              <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50">
                <div className="bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap">
                  Confidence from Integrity Agent
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
