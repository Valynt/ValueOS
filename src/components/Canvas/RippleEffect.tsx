import React, { useEffect, useState } from 'react';

interface RippleEffectProps {
  componentId: string;
  position: { x: number; y: number };
  onComplete: () => void;
}

export const RippleEffect: React.FC<RippleEffectProps> = ({
  position,
  onComplete
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-blue-400 rounded-full opacity-60 animate-ping"
             style={{ width: '40px', height: '40px', marginLeft: '-20px', marginTop: '-20px' }} />
        <div className="absolute inset-0 bg-blue-500 rounded-full opacity-40 animate-pulse"
             style={{ width: '60px', height: '60px', marginLeft: '-30px', marginTop: '-30px' }} />
      </div>
    </div>
  );
};
