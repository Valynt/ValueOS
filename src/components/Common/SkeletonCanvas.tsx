/**
 * Skeleton Loader for Canvas
 * Shows placeholder UI while canvas content is loading
 */

import React from 'react';

export const SkeletonCanvas: React.FC = () => {
  return (
    <div className="p-6 space-y-6 animate-pulse" role="status" aria-label="Loading canvas">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-6 bg-gray-800 rounded w-1/3"></div>
        <div className="h-4 bg-gray-800 rounded w-1/4"></div>
      </div>

      {/* Grid of cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-gray-800 rounded-lg"></div>
        <div className="h-32 bg-gray-800 rounded-lg"></div>
        <div className="h-32 bg-gray-800 rounded-lg"></div>
      </div>

      {/* Large content block skeleton */}
      <div className="space-y-3">
        <div className="h-64 bg-gray-800 rounded-lg"></div>
        <div className="h-4 bg-gray-800 rounded w-3/4"></div>
        <div className="h-4 bg-gray-800 rounded w-2/3"></div>
      </div>

      {/* Bottom cards skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-gray-800 rounded-lg"></div>
        <div className="h-48 bg-gray-800 rounded-lg"></div>
      </div>

      <span className="sr-only">Loading content...</span>
    </div>
  );
};

export const SkeletonKPI: React.FC = () => (
  <div className="p-4 bg-gray-800 rounded-lg animate-pulse">
    <div className="h-4 bg-gray-700 rounded w-1/2 mb-3"></div>
    <div className="h-8 bg-gray-700 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-700 rounded w-1/3"></div>
  </div>
);

export const SkeletonChart: React.FC = () => (
  <div className="p-4 bg-gray-800 rounded-lg animate-pulse">
    <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
    <div className="h-64 bg-gray-700 rounded"></div>
  </div>
);

export const SkeletonTable: React.FC = () => (
  <div className="p-4 bg-gray-800 rounded-lg animate-pulse space-y-3">
    <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="grid grid-cols-4 gap-4">
        <div className="h-3 bg-gray-700 rounded"></div>
        <div className="h-3 bg-gray-700 rounded"></div>
        <div className="h-3 bg-gray-700 rounded"></div>
        <div className="h-3 bg-gray-700 rounded"></div>
      </div>
    ))}
  </div>
);
