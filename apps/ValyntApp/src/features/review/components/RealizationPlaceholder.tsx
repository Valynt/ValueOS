/**
 * RealizationPlaceholder — Coming soon placeholder for post-sale tracking.
 *
 * Route: /review/:caseId/actuals
 * Full implementation in Phase 5.
 */

import { TrendingUp } from "lucide-react";

export function RealizationPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-dashed border-amber-300 flex items-center justify-center mb-4">
        <TrendingUp className="w-7 h-7 text-amber-500" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">
        Realization Tracking — Coming Soon
      </h2>
      <p className="text-sm text-zinc-500 max-w-md mb-4">
        Track actual value delivered vs. projected value. This feature is under
        development for Customer Success teams.
      </p>
      <button
        type="button"
        className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
      >
        Notify me when available
      </button>
    </div>
  );
}
