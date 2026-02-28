/**
 * ResumePhase — Context restore animation for session recovery.
 * Shows a blur-to-focus transition while loading previous session state.
 */

import React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ResumePhaseProps {
  /** Session being restored */
  sessionLabel?: string;
  /** Number of messages being restored */
  messageCount?: number;
  /** Number of artifacts being restored */
  artifactCount?: number;
  /** 0-100 progress of context restoration */
  progress?: number;
  className?: string;
}

export function ResumePhase({
  sessionLabel,
  messageCount = 0,
  artifactCount = 0,
  progress = 0,
  className,
}: ResumePhaseProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 p-8 animate-context-restore", className)}>
      {/* Restore animation — concentric rings */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-28 h-28 rounded-full border-2 border-cyan-200 animate-ping opacity-20" />
        <div className="absolute w-20 h-20 rounded-full border-2 border-cyan-300 animate-pulse-subtle" />
        <div className="w-14 h-14 rounded-full bg-cyan-50 border-2 border-cyan-400 flex items-center justify-center z-10">
          <svg className="w-6 h-6 text-cyan-600" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" />
            <path d="M3 3v5h5" stroke="currentColor" />
          </svg>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">
          Restoring Session
        </h3>
        {sessionLabel && (
          <p className="text-sm text-slate-500 mb-2">{sessionLabel}</p>
        )}
        <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
          {messageCount > 0 && (
            <span>{messageCount} message{messageCount !== 1 ? "s" : ""}</span>
          )}
          {artifactCount > 0 && (
            <>
              <span>&middot;</span>
              <span>{artifactCount} artifact{artifactCount !== 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-full max-w-xs">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-center text-2xs text-slate-400 mt-1 tabular-nums">
            {progress}%
          </div>
        </div>
      )}

      {/* Context cards (what's being restored) */}
      <Card className="p-3 border-cyan-200 bg-cyan-50/50 w-full max-w-sm">
        <div className="space-y-2">
          <RestoreItem label="Conversation history" done={progress > 30} />
          <RestoreItem label="Agent context & memory" done={progress > 60} />
          <RestoreItem label="Artifacts & checkpoints" done={progress > 90} />
        </div>
      </Card>
    </div>
  );
}

function RestoreItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <svg className="w-4 h-4 text-cyan-600 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
      )}
      <span className={cn("text-slate-600", done && "text-slate-500")}>{label}</span>
    </div>
  );
}
