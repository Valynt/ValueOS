import { Play, Shield } from "lucide-react";

interface IntegrityEmptyStateProps {
  onRun: () => void;
  isRunning: boolean;
}

export function IntegrityEmptyState({ onRun, isRunning }: IntegrityEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
        <Shield className="w-6 h-6 text-zinc-400" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-zinc-900">No integrity analysis yet</p>
        <p className="text-[12px] text-zinc-500 mt-1">
          Run the Integrity agent to validate your claims
        </p>
      </div>
      <button
        onClick={onRun}
        disabled={isRunning}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-xl text-[12px] font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="w-3.5 h-3.5" />
        {isRunning ? "Running…" : "Run Integrity Agent"}
      </button>
    </div>
  );
}
