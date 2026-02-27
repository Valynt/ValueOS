/**
 * FE-029: Resume State UI
 *
 * Shown when restoring a previous session. Displays a summary of
 * the restored conversation and artifacts, with option to continue
 * or start fresh.
 */

import { useState, useEffect } from "react";
import {
  RotateCcw,
  MessageSquare,
  FileText,
  ArrowRight,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ConversationMessage, Artifact } from "../../agent/types";

interface ResumePanelProps {
  messages: ConversationMessage[];
  artifacts: Artifact[];
  onContinue: () => void;
  onStartFresh: () => void;
}

export function ResumePanel({
  messages,
  artifacts,
  onContinue,
  onStartFresh,
}: ResumePanelProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const lastMessage = messages.filter((m) => m.role === "agent").slice(-1)[0];
  const lastUserMessage = messages.filter((m) => m.role === "user").slice(-1)[0];
  const approvedArtifacts = artifacts.filter((a) => a.status === "approved");

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        {loading ? (
          <Loader2 size={16} className="text-slate-500 animate-spin" />
        ) : (
          <RotateCcw size={16} className="text-slate-600" />
        )}
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {loading ? "Restoring Session..." : "Previous Session Found"}
        </span>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 size={24} className="text-slate-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Session summary */}
          <div className="p-4 space-y-3">
            {/* Stats */}
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MessageSquare size={12} />
                <span>{messages.length} messages</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <FileText size={12} />
                <span>{artifacts.length} artifacts</span>
              </div>
              {lastMessage && (
                <div className="text-xs text-slate-400">
                  {formatTime(lastMessage.timestamp)}
                </div>
              )}
            </div>

            {/* Last exchange preview */}
            {lastUserMessage && (
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="text-[10px] font-medium text-slate-400 uppercase">
                  Last exchange
                </div>
                <div className="text-xs text-slate-600">
                  <span className="font-medium text-slate-700">You:</span>{" "}
                  <span className="line-clamp-1">{lastUserMessage.content}</span>
                </div>
                {lastMessage && (
                  <div className="text-xs text-slate-600">
                    <span className="font-medium text-primary">Agent:</span>{" "}
                    <span className="line-clamp-2">{lastMessage.content}</span>
                  </div>
                )}
              </div>
            )}

            {/* Approved artifacts */}
            {approvedArtifacts.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-medium text-slate-400 uppercase">
                  Saved artifacts
                </div>
                {approvedArtifacts.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <FileText size={10} className="text-slate-400" />
                    <span className="truncate">{a.title}</span>
                  </div>
                ))}
                {approvedArtifacts.length > 3 && (
                  <span className="text-[10px] text-slate-400">
                    +{approvedArtifacts.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onStartFresh}
              className="flex-1 text-slate-500"
            >
              <Trash2 size={14} className="mr-1.5" />
              Start Fresh
            </Button>
            <Button
              size="sm"
              onClick={onContinue}
              className="flex-1"
            >
              Continue
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
