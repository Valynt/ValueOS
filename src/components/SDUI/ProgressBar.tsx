const MAX_PROGRESS = 100;
const MIN_PROGRESS = 0;

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  variant?: "default" | "success" | "warning" | "error";
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  variant = "default",
}: ProgressBarProps) {
  const clampedProgress = Math.min(
    MAX_PROGRESS,
    Math.max(MIN_PROGRESS, progress)
  );

  const variantColors = {
    default: "bg-primary",
    success: "bg-green-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          {label && <span>{label}</span>}
          {showPercentage && <span>{clampedProgress}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${variantColors[variant]} transition-all duration-300 rounded-full`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
