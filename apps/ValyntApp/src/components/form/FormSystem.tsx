import { ReactNode, useCallback } from "react";
import {
  useForm,
  UseFormReturn,
  FieldValues,
  DefaultValues,
  Path,
  SubmitHandler,
  FieldError,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { AlertCircle, Check, Loader2 } from "lucide-react";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const { handleSubmit, formState: { isSubmitting } } = form;

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
  helpText?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required = false,
  error,
  helpText,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {children}

      {helpText && <p className="text-sm text-muted-foreground">{helpText}</p>}

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error.message}
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
  const { register, formState: { errors } } = form;
  const error = errors[name] as FieldError | undefined;

  return (
    <FormField label={label} required={required} error={error} helpText={helpText}>
      <input
        {...register(name)}
        {...props}
        className={cn(
          "w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors",
          error ? "border-destructive" : "border-input",
          className
        )}
      />
    </FormField>
  );
}

interface FormTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "form"> {
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
  const { register, formState: { errors } } = form;
  const error = errors[name] as FieldError | undefined;

  return (
    <FormField label={label} required={required} error={error} helpText={helpText}>
      <textarea
        {...register(name)}
        {...props}
        className={cn(
          "w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors resize-y min-h-[100px]",
          error ? "border-destructive" : "border-input",
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
  const { register, formState: { errors } } = form;
  const error = errors[name] as FieldError | undefined;

  return (
    <FormField label={label} required={required} error={error} helpText={helpText}>
      <select
        {...register(name)}
        {...props}
        className={cn(
          "w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors",
          error ? "border-destructive" : "border-input",
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
