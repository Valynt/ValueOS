import React from "react";
import { z } from "zod";
import { AlertCircle, CheckCircle } from "lucide-react";
import { sanitizeString } from "../../security";

// Import the unified form system
import {
  Form,
  FormInput,
  useFormWithValidation,
  useOptimisticUpdate,
} from "../Form/FormSystem";

// Zod schema for KPI validation
const kpiSchema = z
  .object({
    baseline: z
      .number({
        required_error: "Baseline is required",
        invalid_type_error: "Baseline must be a number",
      })
      .min(0, "Baseline must be a positive number"),
    target: z
      .number({
        required_error: "Target is required",
        invalid_type_error: "Target must be a number",
      })
      .min(0, "Target must be a positive number"),
  })
  .refine((data) => data.target > data.baseline, {
    message: "Target must be greater than baseline",
    path: ["target"],
  });

/**
 * Props for KPIForm component
 */
export interface KPIFormProps {
  /**
   * Name of the KPI being configured
   */
  kpiName: string;

  /**
   * Callback when form is submitted
   */
  onSubmit: (baseline: number, target: number) => void | Promise<void>;

  /**
   * Initial baseline value
   */
  initialBaseline?: number;

  /**
   * Initial target value
   */
  initialTarget?: number;

  /**
   * Optional description of the KPI
   */
  description?: string;

  /**
   * Unit of measurement (e.g., '%', 'hours', 'USD')
   */
  unit?: string;

  /**
   * Whether the form is in loading state
   */
  loading?: boolean;

  /**
   * Whether the form is disabled
   */
  disabled?: boolean;

  /**
   * Callback when form is cancelled
   */
  onCancel?: () => void;

  /**
   * Show success message after submission
   */
  showSuccess?: boolean;
}

/**
 * KPIForm - A form for entering baseline and target values for a KPI
 *
 * Used in the Target stage to define value commitments with baseline
 * and target metrics. Now uses React Hook Form + Zod for validation
 * and optimistic updates.
 *
 * @example
 * ```tsx
 * <KPIForm
 *   kpiName="Lead Conversion Rate"
 *   unit="%"
 *   onSubmit={(baseline, target) => {
 *     logger.debug(`Baseline: ${baseline}, Target: ${target}`);
 *   }}
 * />
 * ```
 */
export const KPIForm: React.FC<KPIFormProps> = ({
  kpiName,
  onSubmit,
  initialBaseline,
  initialTarget,
  description,
  unit,
  loading = false,
  disabled = false,
  onCancel,
  showSuccess = false,
}) => {
  const safeKpiName = sanitizeString(kpiName, {
    maxLength: 120,
    stripScripts: true,
  }).sanitized;
  const safeUnit = unit
    ? sanitizeString(unit, { maxLength: 16, stripScripts: true }).sanitized
    : unit;

  // Initialize form with Zod validation
  const form = useFormWithValidation({
    schema: kpiSchema,
    defaultValues: {
      baseline: initialBaseline || "",
      target: initialTarget || "",
    },
    mode: "onChange",
  });

  const {
    watch,
    formState: { isSubmitting },
  } = form;

  // Watch form values for improvement calculation
  const watchedValues = watch();
  const baseline = watchedValues.baseline;
  const target = watchedValues.target;

  // Calculate improvement percentage
  const improvement =
    typeof baseline === "number" && typeof target === "number" && baseline > 0
      ? (((target - baseline) / baseline) * 100).toFixed(1)
      : null;

  // Optimistic update hook
  const { execute: executeOptimisticUpdate } = useOptimisticUpdate({
    onSuccess: () => {
      // Success message will be shown by showSuccess prop
    },
    onError: (error) => {
      console.error("Failed to save KPI:", error);
    },
  });

  // Handle form submission with optimistic updates
  const handleSubmit = async (values: { baseline: number; target: number }) => {
    try {
      await executeOptimisticUpdate(
        { baseline: values.baseline, target: values.target },
        await onSubmit(values.baseline, values.target)
      );
    } catch (error) {
      // Error handling is done in the optimistic update hook
      throw error;
    }
  };

  return (
    <Form
      form={form}
      onSubmit={handleSubmit}
      className="space-y-4 p-4 border border-border rounded-lg bg-card text-card-foreground shadow-beautiful-md"
      loading={loading || isSubmitting}
      disabled={disabled}
      submitLabel="Save KPI"
      cancelLabel="Cancel"
      onCancel={onCancel}
    >
      {/* Header */}
      <div className="border-b border-border pb-3">
        <h3 className="text-lg font-bold text-foreground">{safeKpiName}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {/* Success Message */}
      {showSuccess && !isSubmitting && (
        <div
          className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md"
          role="alert"
        >
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-800">
            KPI values saved successfully!
          </span>
        </div>
      )}

      {/* Baseline Input */}
      <FormInput
        form={form}
        name="baseline"
        label={`Baseline${safeUnit ? ` (${safeUnit})` : ""}`}
        type="number"
        step="any"
        placeholder="Enter current baseline value"
        required
        helpText="The current baseline value for this KPI"
      />

      {/* Target Input */}
      <FormInput
        form={form}
        name="target"
        label={`Target${safeUnit ? ` (${safeUnit})` : ""}`}
        type="number"
        step="any"
        placeholder="Enter target value"
        required
        helpText="The target value you want to achieve"
      />

      {/* Improvement Calculation */}
      {improvement !== null && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Expected Improvement:</span>{" "}
            <span className="font-bold text-blue-700">{improvement}%</span>
          </p>
        </div>
      )}
    </Form>
  );
};
