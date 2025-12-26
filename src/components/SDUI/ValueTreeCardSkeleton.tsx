import React from "react";

export const ValueTreeCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col w-full h-64 border rounded-lg shadow-sm animate-pulse bg-white p-4 space-y-4">
      {/* Header - 40px height */}
      <div className="h-10 w-3/4 bg-gray-200 rounded" />

      {/* Body - Flexible height */}
      <div className="flex-1 space-y-2">
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-5/6 bg-gray-200 rounded" />
        <div className="h-4 w-4/6 bg-gray-200 rounded" />
      </div>

      {/* Footer - 32px height */}
      <div className="h-8 w-1/2 bg-gray-200 rounded" />
    </div>
  );
};
