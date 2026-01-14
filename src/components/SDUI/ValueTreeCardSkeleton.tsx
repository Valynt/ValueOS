import React from "react";
import { Skeleton } from "../Common/SkeletonSystem";

export const ValueTreeCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col w-full h-64 border rounded-lg shadow-sm animate-pulse bg-white p-4 space-y-4">
      {/* Header - 40px height */}
      <Skeleton height="2.5rem" width="75%" />

      {/* Body - Flexible height */}
      <div className="flex-1 space-y-2">
        <Skeleton height="1rem" width="100%" />
        <Skeleton height="1rem" width="5/6" />
        <Skeleton height="1rem" width="4/6" />
      </div>

      {/* Footer - 32px height */}
      <Skeleton height="2rem" width="50%" />
    </div>
  );
};
