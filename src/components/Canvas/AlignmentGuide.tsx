import React from 'react';

interface AlignmentGuideProps {
  orientation: 'horizontal' | 'vertical';
  position: number;
  canvasSize: { width: number; height: number };
}

export const AlignmentGuide: React.FC<AlignmentGuideProps> = ({
  orientation,
  position,
  canvasSize
}) => {
  const style = orientation === 'horizontal'
    ? {
        position: 'absolute' as const,
        left: 0,
        top: position,
        width: canvasSize.width,
        height: 1,
        backgroundColor: '#3b82f6',
        opacity: 0.6,
        zIndex: 30,
        pointerEvents: 'none' as const
      }
    : {
        position: 'absolute' as const,
        left: position,
        top: 0,
        width: 1,
        height: canvasSize.height,
        backgroundColor: '#3b82f6',
        opacity: 0.6,
        zIndex: 30,
        pointerEvents: 'none' as const
      };

  return <div style={style} className="animate-fade-in" />;
};
