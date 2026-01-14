/**
 * Unified Form System
 *
 * React Hook Form + Zod integration for consistent form state management,
 * validation, and optimistic updates across all forms.
 */

import React, { ReactNode, useCallback } from "react";
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
import { ZodSchema, ZodError } from "zod";
import { AlertCircle, Check, Loader2 } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface FormOptions<T extends FieldValues> {
  schema?: ZodSchema<T>;
  defaultValues?: DefaultValues<T>;
  mode?: "onChange" | "onBlur" | "onSubmit" | "onTouched" | "all";
  reValidateMode?: "onChange" | "onBlur" | "onSubmit";
  criteriaMode?: "firstError" | "all";
  shouldFocusError?: boolean;
  delayError?: number;
}

export interface FormProps<T extends FieldValues> {
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

// ============================================================================
// Base Form Hook
// ============================================================================

export function useFormWithValidation<T extends FieldValues>(
  options: FormOptions<T> = {}
): UseFormReturn<T> {
  const {
    schema,
    defaultValues,
    mode = "onChange",
    reValidateMode = "onChange",
    criteriaMode = "firstError",
    shouldFocusError = true,
    delayError = 0,
  } = options;

  return useForm<T>({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
    mode,
    reValidateMode,
    criteriaMode,
    shouldFocusError,
    delayError,
  });
}

// ============================================================================
// Base Form Component
// ============================================================================

export function Form<T extends FieldValues>({
  form,
  onSubmit,
  children,
  className = "",
  loading = false,
  disabled = false,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onCancel,
}: FormProps<T>) {
  const {
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = form;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      noValidate // We handle validation with React Hook Form
    >
      {children}

      {/* Form Actions */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || disabled}
            className="px-5 py-2.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={loading || disabled || isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-all"
        >
          {loading || isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {loading ? "Saving..." : "Submitting..."}
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

// ============================================================================
// Form Field Components
// ============================================================================

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
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {children}

      {helpText && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{helpText}</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error.message}
        </p>
      )}
    </div>
  );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  form: UseFormReturn<any>;
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
  className = "",
  ...props
}: FormInputProps) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      <input
        {...register(name)}
        {...props}
        className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-colors ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600"
        } ${className}`}
      />
    </FormField>
  );
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  form: UseFormReturn<any>;
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
  className = "",
  ...props
}: FormTextareaProps) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      <textarea
        {...register(name)}
        {...props}
        className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-colors resize-y min-h-[100px] ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600"
        } ${className}`}
      />
    </FormField>
  );
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  form: UseFormReturn<any>;
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
  className = "",
  ...props
}: FormSelectProps) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      <select
        {...register(name)}
        {...props}
        className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-colors ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600"
        } ${className}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

// ============================================================================
// Optimistic Updates Hook
// ============================================================================

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  rollbackOnError?: boolean;
}

export function useOptimisticUpdate<T>(
  updateFn: (data: T) => Promise<any>,
  options: OptimisticUpdateOptions<T> = {}
) {
  const { onSuccess, onError, rollbackOnError = true } = options;

  const execute = useCallback(
    async (optimisticData: T, actualData?: T) => {
      try {
        // Apply optimistic update
        onSuccess?.(optimisticData);

        // Execute actual update
        const result = await updateFn(actualData || optimisticData);

        // Success - optimistic update was correct
        return result;
      } catch (error) {
        // Error - rollback optimistic update if enabled
        if (rollbackOnError) {
          // Note: In a real implementation, you'd need to track previous state
          // and restore it. This is a simplified version.
        }

        onError?.(error as Error);
        throw error;
      }
    },
    [updateFn, onSuccess, onError, rollbackOnError]
  );

  return { execute };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getFieldError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: Path<T>
): FieldError | undefined {
  return form.formState.errors[fieldName];
}

export function setFormError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: Path<T>,
  message: string
) {
  form.setError(fieldName, { message });
}

export function clearFormError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: Path<T>
) {
  form.clearErrors(fieldName);
}

export function resetForm<T extends FieldValues>(
  form: UseFormReturn<T>,
  values?: DefaultValues<T>
) {
  form.reset(values);
}

// ============================================================================
// Zod Schema Utilities
// ============================================================================

export function createFormSchema<T extends FieldValues>(
  fields: Record<keyof T, ZodSchema>
): ZodSchema<T> {
  return Object.entries(fields).reduce(
    (schema, [key, fieldSchema]) => ({
      ...schema,
      [key]: fieldSchema,
    }),
    {} as any
  ) as ZodSchema<T>;
}
