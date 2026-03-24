import * as React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  switchSize?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizeConfig = {
  sm: { track: "w-8 h-4", thumb: "w-3 h-3", translate: "translate-x-4" },
  md: { track: "w-11 h-6", thumb: "w-5 h-5", translate: "translate-x-5" },
  lg: { track: "w-14 h-7", thumb: "w-6 h-6", translate: "translate-x-7" },
} as const;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, switchSize = "md", disabled, ...props }, ref) => {
    const config = sizeConfig[switchSize];
    const [internalChecked, setInternalChecked] = React.useState(checked ?? false);
    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked;
      if (!isControlled) setInternalChecked(newChecked);
      onCheckedChange?.(newChecked);
    };

    return (
      <label
        className={cn(
          "relative inline-flex items-center cursor-pointer",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={isChecked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            "bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/30",
            "rounded-full peer transition-all duration-200 ease-in-out",
            "peer-checked:bg-[var(--vds-color-primary)]",
            config.track,
            className
          )}
        >
          <div
            className={cn(
              "bg-white rounded-full shadow-sm transition-all duration-200 ease-in-out",
              "absolute top-0.5 left-0.5",
              config.thumb,
              isChecked && config.translate
            )}
          />
        </div>
      </label>
    );
  }
);
Switch.displayName = "Switch";
