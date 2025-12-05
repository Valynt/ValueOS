import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DeltaBadgeProps {
  componentId: string;
  oldValue: string | number;
  newValue: string | number;
  position: { x: number; y: number };
  onComplete: () => void;
}

export const DeltaBadge: React.FC<DeltaBadgeProps> = ({
  oldValue,
  newValue,
  position,
  onComplete
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  const calculateDelta = () => {
    const oldNum = parseFloat(String(oldValue).replace(/[^0-9.-]/g, ''));
    const newNum = parseFloat(String(newValue).replace(/[^0-9.-]/g, ''));

    if (isNaN(oldNum) || isNaN(newNum)) {
      return { type: 'neutral', text: 'Updated' };
    }

    const diff = newNum - oldNum;
    const percentChange = oldNum !== 0 ? (diff / Math.abs(oldNum)) * 100 : 0;

    if (Math.abs(diff) < 0.01) {
      return { type: 'neutral', text: 'No change', icon: Minus };
    }

    if (diff > 0) {
      return {
        type: 'up',
        text: `+${percentChange.toFixed(1)}%`,
        icon: TrendingUp
      };
    }

    return {
      type: 'down',
      text: `${percentChange.toFixed(1)}%`,
      icon: TrendingDown
    };
  };

  const delta = calculateDelta();
  const Icon = delta.icon;

  const colorClasses = {
    up: 'bg-green-100 text-green-800 border-green-300',
    down: 'bg-red-100 text-red-800 border-red-300',
    neutral: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  return (
    <div
      className="absolute z-50 pointer-events-none animate-fade-in-down"
      style={{
        left: position.x,
        top: position.y - 40,
      }}
    >
      <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border-2 shadow-lg ${colorClasses[delta.type as keyof typeof colorClasses]}`}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span className="text-xs font-semibold">{delta.text}</span>
      </div>
    </div>
  );
};
