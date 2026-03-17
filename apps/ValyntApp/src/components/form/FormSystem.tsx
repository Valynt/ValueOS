import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, CheckCircle, Loader2 } from "lucide-react";
import { ReactNode, useId } from "react";
import {
  DefaultValues,
  FieldError,
  FieldValues,
  Path,
  SubmitHandler,
  useForm,
  UseFormReturn,
} from "react-hook-form";
import type { ZodType } from "zod";

import { cn } from "@/lib/utils";

export interface FormOptions<T extends FieldValues> {
  schema?: ZodType<T>;
  defaultValues?: DefaultValues<T>;
  mode?: "onChange" | "onBlur" | "onSubmit" | "onTouched" | "all";
}

export function useFormWithValidation<T extends FieldValues>(
  options: FormOptions<T> = {}
): UseFormReturn<T> {
  const { schema, defaultValues, mode = "onChange" } = options;

  return useForm<T>({
     
    resolver: schema ? zodResolver(schema as any) : undefined,
    defaultValues,
    mode,
  });
}

interface FormProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
  children: ReactNode;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
}

export function Form<T extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  loading = false,
  disabled = false,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onCancel,
}: FormProps<T>) {
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={className} noValidate>
      {children}

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || disabled}
            className="px-4 py-2 border rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={loading || disabled || isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading || isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: FieldError;
  success?: boolean;
  validating?: boolean;
  helpText?: string;
  className?: string;
  children: ReactNode;
  inputId?: string;
  helpTextId?: string;
  errorId?: string;
}

export function FormField({
  label,
  required = false,
  error,
  success = false,
  validating = false,
  helpText,
  className,
  children,
  inputId,
  helpTextId,
  errorId,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      <div className="relative">
        {children}

        {/* Validation indicators */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {validating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {success && !error && <CheckCircle className="w-4 h-4 text-success" />}
          {error && <AlertCircle className="w-4 h-4 text-destructive" />}
        </div>
      </div>

      {helpText && !error && (
        <p id={helpTextId} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive flex items-start gap-1 animate-in slide-in-from-top-1"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error.message}</span>
        </p>
      )}

      {success && !error && (
        <p className="text-sm text-success flex items-center gap-1 animate-in slide-in-from-top-1">
          <CheckCircle className="w-4 h-4" />
          <span>Looks good!</span>
        </p>
      )}
    </div>
  );
}

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "form"> {
  name: string;
  form: UseFormReturn<FieldValues>;
  label: string;
  required?: boolean;
  helpText?: string;
}

export function FormInput({
  name,
  form,
  label,
  required,
  helpText,
  className,
  ...props
}: FormInputProps) {
  const {
    register,
    formState: { errors, touchedFields },
    watch,
  } = form;
  const error = errors[name] as FieldError | undefined;
  const touched = touchedFields[name];
  const value = watch(name);

  // Determine validation state
  const isValid = touched && !error && value;
  const isValidating = false; // Could be enhanced with async validation

  const generatedId = useId();
  const inputId = props.id || generatedId;
  const helpTextId = helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      success={isValid}
      validating={isValidating}
      helpText={helpText}
      inputId={inputId}
      helpTextId={helpTextId}
      errorId={errorId}
    >
      <input
        id={inputId}
        aria-describedby={
          [(!error ? helpTextId : undefined), errorId]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...register(name)}
        {...props}
        className={cn(
          "w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors",
          "placeholder:text-muted-foreground",
          {
            "border-destructive focus:ring-destructive": error,
            "border-success focus:ring-success": isValid && !error,
            "border-input focus:ring-primary": !error && !isValid,
          },
          className
        )}
      />
    </FormField>
  );
}

interface FormTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "form"
> {
  name: string;
  form: UseFormReturn<FieldValues>;
  label: string;
  required?: boolean;
  helpText?: string;
}

export function FormTextarea({
  name,
  form,
  label,
  required,
  helpText,
  className,
  ...props
}: FormTextareaProps) {
  const {
    register,
    formState: { errors, touchedFields },
    watch,
  } = form;
  const error = errors[name] as FieldError | undefined;
  const touched = touchedFields[name];
  const value = watch(name);

  // Determine validation state
  const isValid = touched && !error && value;
  const isValidating = false; // Could be enhanced with async validation

  const generatedId = useId();
  const inputId = props.id || generatedId;
  const helpTextId = helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      success={isValid}
      validating={isValidating}
      helpText={helpText}
      inputId={inputId}
      helpTextId={helpTextId}
      errorId={errorId}
    >
      <textarea
        id={inputId}
        aria-describedby={
          [(!error ? helpTextId : undefined), errorId]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...register(name)}
        {...props}
        className={cn(
          "w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors resize-y min-h-[100px]",
          "placeholder:text-muted-foreground",
          {
            "border-destructive focus:ring-destructive": error,
            "border-success focus:ring-success": isValid && !error,
            "border-input focus:ring-primary": !error && !isValid,
          },
          className
        )}
      />
    </FormField>
  );
}

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "form"> {
  name: string;
  form: UseFormReturn<FieldValues>;
  label: string;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

export function FormSelect({
  name,
  form,
  label,
  options,
  placeholder,
  required,
  helpText,
  className,
  ...props
}: FormSelectProps) {
  const {
    register,
    formState: { errors, touchedFields },
    watch,
  } = form;
  const error = errors[name] as FieldError | undefined;
  const touched = touchedFields[name];
  const value = watch(name);

  // Determine validation state
  const isValid = touched && !error && value && value !== "";
  const isValidating = false; // Could be enhanced with async validation

  const generatedId = useId();
  const inputId = props.id || generatedId;
  const helpTextId = helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      success={isValid}
      validating={isValidating}
      helpText={helpText}
      inputId={inputId}
      helpTextId={helpTextId}
      errorId={errorId}
    >
      <select
        id={inputId}
        aria-describedby={
          [(!error ? helpTextId : undefined), errorId]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...register(name)}
        {...props}
        className={cn(
          "w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors",
          "placeholder:text-muted-foreground",
          {
            "border-destructive focus:ring-destructive": error,
            "border-success focus:ring-success": isValid && !error,
            "border-input focus:ring-primary": !error && !isValid,
          },
          className
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export function getFieldError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: Path<T>
): FieldError | undefined {
  return form.formState.errors[fieldName] as FieldError | undefined;
}

export function setFormError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: Path<T>,
  message: string
) {
  form.setError(fieldName, { message });
}

export function resetForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  values?: DefaultValues<T>
) {
  form.reset(values);
}
