import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <Input
        type={showPassword ? "text" : "password"}
        className={cn(
          "hide-password-toggle pr-10",
          "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
          className
        )}
        ref={ref}
        {...props}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="hover:text-foreground focus:outline-none focus:text-foreground text-muted-foreground transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        }
      />
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
