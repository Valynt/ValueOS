/**
 * Validated Input Component
 * 
 * Input with inline validation feedback
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  valid?: boolean;
  showValidation?: boolean;
  helperText?: string;
}

const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ className, label, error, valid, showValidation = true, helperText, id, ...props }, ref) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
    const hasError = showValidation && error;
    const isValid = showValidation && valid && !error;

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={inputId} className={cn(hasError && 'text-destructive')}>
            {label}
          </Label>
        )}
        <div className="relative">
          <Input
            id={inputId}
            ref={ref}
            className={cn(
              className,
              hasError && 'border-destructive focus-visible:ring-destructive',
              isValid && 'border-green-500 focus-visible:ring-green-500'
            )}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-describedby={
              hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          {showValidation && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {hasError && (
                <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
              )}
              {isValid && (
                <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
              )}
            </div>
          )}
        </div>
        {hasError && (
          <p id={`${inputId}-error`} className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
        {!hasError && helperText && (
          <p id={`${inputId}-helper`} className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

export { ValidatedInput };
