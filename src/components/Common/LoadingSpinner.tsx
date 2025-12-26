import React from "react";

/**
 * Loading Spinner Component
 * Displayed during lazy loading of route components
 */
export function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export default LoadingSpinner;
