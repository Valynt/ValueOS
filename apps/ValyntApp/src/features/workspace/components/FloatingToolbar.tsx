/**
 * FloatingToolbar
 * 
 * Floating action bar at bottom of canvas with undo/redo/save/export.
 * Inspired by ValueCanvas UI mockups.
 */

import React from 'react';
import { 
  Undo2, 
  Redo2, 
  Save, 
  Download, 
  Sparkles,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingToolbarProps {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isSaving?: boolean;
  className?: string;
}

export function FloatingToolbar({
  onUndo,
  onRedo,
  onSave,
  onExport,
  onRegenerate,
  onCopy,
  canUndo = false,
  canRedo = false,
  isSaving = false,
  className,
}: FloatingToolbarProps) {
  return (
    <div 
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-1 px-2 py-2",
        "bg-slate-900/95 backdrop-blur-sm rounded-full shadow-2xl",
        "border border-slate-700/50",
        className
      )}
    >
      {/* Regenerate */}
      {onRegenerate && (
        <ToolbarButton
          icon={Sparkles}
          label="Regenerate"
          onClick={onRegenerate}
          variant="primary"
        />
      )}

      {/* Divider */}
      {onRegenerate && <ToolbarDivider />}

      {/* Undo */}
      <ToolbarButton
        icon={Undo2}
        label="Undo"
        onClick={onUndo}
        disabled={!canUndo}
      />

      {/* Redo */}
      <ToolbarButton
        icon={Redo2}
        label="Redo"
        onClick={onRedo}
        disabled={!canRedo}
      />

      {/* Divider */}
      <ToolbarDivider />

      {/* Copy */}
      {onCopy && (
        <ToolbarButton
          icon={Copy}
          label="Copy"
          onClick={onCopy}
        />
      )}

      {/* Save */}
      {onSave && (
        <ToolbarButton
          icon={Save}
          label="Save"
          onClick={onSave}
          loading={isSaving}
        />
      )}

      {/* Export */}
      <ToolbarButton
        icon={Download}
        label="Export PDF"
        onClick={onExport}
        variant="accent"
      />
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'primary' | 'accent';
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  variant = 'default',
}: ToolbarButtonProps) {
  const variants = {
    default: 'text-slate-400 hover:text-white hover:bg-slate-700/50',
    primary: 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/20',
    accent: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={label}
      className={cn(
        "p-2.5 rounded-full transition-all duration-150",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        variants[variant]
      )}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon className="w-5 h-5" />
      )}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-slate-700 mx-1" />;
}

export default FloatingToolbar;
