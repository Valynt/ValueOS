import * as React from "react";
import { cn } from "../../lib/utils";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  value?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
}

const sizeConfig = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
} as const;

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({
    className,
    value,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    size = "md",
    showValue = false,
    valueFormatter = (v) => String(v),
    ...props
  }, ref) => {
    const percentage = ((value ?? min) - min) / (max - min) * 100;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      onValueChange?.(newValue);
    };

    return (
      <div className="flex items-center gap-3 w-full">
        <div className="relative flex-1">
          {/* Track background */}
          <div className={cn("w-full bg-gray-200 rounded-full", sizeConfig[size])}>
            {/* Filled portion */}
            <div
              className={cn(
                "h-full bg-[var(--vds-color-primary)] rounded-full transition-all duration-150",
                sizeConfig[size]
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {/* Native range input (invisible but functional) */}
          <input
            type="range"
            ref={ref}
            min={min}
            max={max}
            step={step}
            value={value ?? min}
            onChange={handleChange}
            className={cn(
              "absolute inset-0 w-full h-full opacity-0 cursor-pointer",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30 rounded-full"
            )}
            {...props}
          />
          {/* Custom thumb */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md",
              "border border-gray-300 pointer-events-none transition-all duration-150",
              "flex items-center justify-center"
            )}
            style={{ left: `calc(${percentage}% - 8px)` }}
          >
            <div className="w-1.5 h-1.5 bg-[var(--vds-color-primary)] rounded-full" />
          </div>
        </div>
        {showValue && (
          <span className="text-sm font-medium text-[var(--vds-color-text-primary)] min-w-[3ch] text-right">
            {valueFormatter(value ?? min)}
          </span>
        )}
      </div>
    );
  }
);
Slider.displayName = "Slider";
