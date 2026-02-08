import React from "react";

export const Shimmer: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-indigo-100/60 to-transparent" style={{
      backgroundSize: '200% 100%',
      backgroundPosition: '200% 0',
      animation: 'shimmer 1.5s infinite linear',
      zIndex: 1,
      pointerEvents: 'none',
    }} />
    <style>{`
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `}</style>
  </div>
);
