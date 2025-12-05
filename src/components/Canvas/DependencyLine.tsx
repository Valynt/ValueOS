import React, { useEffect, useState } from 'react';

interface DependencyLineProps {
  from: { x: number; y: number; width: number; height: number };
  to: { x: number; y: number; width: number; height: number };
  onComplete: () => void;
}

export const DependencyLine: React.FC<DependencyLineProps> = ({
  from,
  to,
  onComplete
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  const fromCenterX = from.x + from.width / 2;
  const fromCenterY = from.y + from.height / 2;
  const toCenterX = to.x + to.width / 2;
  const toCenterY = to.y + to.height / 2;

  const minX = Math.min(fromCenterX, toCenterX);
  const minY = Math.min(fromCenterY, toCenterY);
  const width = Math.abs(toCenterX - fromCenterX);
  const height = Math.abs(toCenterY - fromCenterY);

  const startX = fromCenterX - minX;
  const startY = fromCenterY - minY;
  const endX = toCenterX - minX;
  const endY = toCenterY - minY;

  const controlX1 = startX + (endX - startX) * 0.5;
  const controlY1 = startY;
  const controlX2 = startX + (endX - startX) * 0.5;
  const controlY2 = endY;

  const path = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

  return (
    <svg
      className="absolute pointer-events-none z-40"
      style={{
        left: minX,
        top: minY,
        width: width + 20,
        height: height + 20,
        overflow: 'visible',
      }}
    >
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
        </linearGradient>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" fillOpacity="0.8" />
        </marker>
      </defs>
      <path
        d={path}
        stroke="url(#lineGradient)"
        strokeWidth="3"
        fill="none"
        markerEnd="url(#arrowhead)"
        className="animate-dash"
        strokeDasharray="10,5"
      />
    </svg>
  );
};
