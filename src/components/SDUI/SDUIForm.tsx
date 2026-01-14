import React, { useMemo } from "react";
import { z } from "zod";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";

// Import the unified form system
import {
  Form,
  FormInput,
  FormTextarea,
  FormSelect,
  useFormWithValidation,
} from "../Form/FormSystem";

// Types (keeping backward compatibility)
export interface FormFieldOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface FormFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface FormField {
  id: string;
  type:
    | "text"
    | "number"
    | "email"
    | "textarea"
    | "select"
    | "checkbox"
    | "date"
    | "currency"
    | "slider"
    | "hidden";
  label: string;
  placeholder?: string;
  defaultValue?: any;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  helpText?: string;
  aiSuggested?: boolean;
  disabled?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface SDUIFormProps {
  id: string;
  title?: string;
  description?: string;
  sections?: FormSection[];
  fields?: FormField[];
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  onCancel?: () => void;
  onChange?: (values: Record<string, any>) => void;
  loading?: boolean;
  disabled?: boolean;
  agentName?: string;
  className?: string;
}

// Create Zod schema from form fields
function createZodSchema(fields: FormField[]) {
  const schema: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let fieldSchema: z.ZodTypeAny;

    // Base schema based on field type
    switch (field.type) {
      case "email":
        fieldSchema = z.string().email(`${field.label} must be a valid email`);
        break;
      case "number":
      case "currency":
        fieldSchema = z.number({
          required_error: `${field.label} is required`,
          invalid_type_error: `${field.label} must be a number`,
        });
        break;
      case "date":
        fieldSchema = z
          .string()
          .refine(
            (val) => !isNaN(Date.parse(val)),
            `${field.label} must be a valid date`
          );
        break;
      default:
        fieldSchema = z.string({
          required_error: `${field.label} is required`,
        });
    }

    // Apply validation rules
    if (field.validation) {
      const v = field.validation;

      if (field.type === "number" || field.type === "currency") {
        // Number validations
        if (v.min !== undefined) {
          fieldSchema = (fieldSchema as z.ZodNumber).min(
            v.min,
            `${field.label} must be at least ${v.min}`
          );
        }
        if (v.max !== undefined) {
          fieldSchema = (fieldSchema as z.ZodNumber).max(
            v.max,
            `${field.label} must be at most ${v.max}`
          );
        }
      } else {
        // String validations
        if (v.minLength !== undefined) {
          fieldSchema = (fieldSchema as z.ZodString).min(
            v.minLength,
            `${field.label} must be at least ${v.minLength} characters`
          );
        }
        if (v.maxLength !== undefined) {
          fieldSchema = (fieldSchema as z.ZodString).max(
            v.maxLength,
            `${field.label} must be at most ${v.maxLength} characters`
          );
        }
      }

      // Required validation
      if (!v.required && field.type !== "number" && field.type !== "currency") {
        fieldSchema = fieldSchema.optional();
      }
    } else if (field.type !== "number" && field.type !== "currency") {
      // Make non-required fields optional by default
      fieldSchema = fieldSchema.optional();
    }

    schema[field.id] = fieldSchema;
  });

  return z.object(schema);
}

const inputClass =
  "w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#444444] rounded-md text-white text-sm focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/20 disabled:opacity-50 transition-colors";

export const SDUIForm: React.FC<SDUIFormProps> = ({
  id,
  title,
  description,
  sections,
  fields,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  onChange,
  loading = false,
  disabled = false,
  agentName,
  className = "",
}) => {
  const allFields = useMemo(
    () => fields || sections?.flatMap((s) => s.fields) || [],
    [fields, sections]
  );

  // Create Zod schema and default values
  const schema = useMemo(() => createZodSchema(allFields), [allFields]);

  const defaultValues = useMemo(() => {
    const values: Record<string, any> = {};
    allFields.forEach((field) => {
      if (field.type === "number" || field.type === "currency") {
        values[field.id] = field.defaultValue ?? "";
      } else {
        values[field.id] = field.defaultValue ?? "";
      }
    });
    return values;
  }, [allFields]);

  // Initialize form with validation
  const form = useFormWithValidation({
    schema,
    defaultValues,
    mode: "onChange",
  });

  const {
    watch,
    formState: { errors },
  } = form;

  // Watch for form changes
  React.useEffect(() => {
    const subscription = watch((values) => {
      onChange?.(values);
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(
    new Set(sections?.filter((s) => s.defaultCollapsed).map((s) => s.id) || [])
  );

  const renderField = (field: FormField) => {
    if (field.type === "hidden") return null;

    const error = errors[field.id];

    // For backward compatibility, render custom field components
    return (
      <div key={field.id} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`${id}-${field.id}`}
            className="text-white text-sm font-medium"
          >
            {field.label}
            {field.validation?.required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>
          {field.aiSuggested && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded text-blue-400 text-[11px]">
              <Sparkles className="w-3 h-3" />
              AI
            </span>
          )}
        </div>

        {field.type === "textarea" ? (
          <FormTextarea
            form={form}
            name={field.id}
            label="" // Label handled above
            placeholder={field.placeholder}
            disabled={field.disabled || disabled}
            className={`${inputClass} min-h-[100px] resize-y ${error ? "border-red-500" : ""}`}
            style={{ display: "block" }} // Override label display
          />
        ) : field.type === "select" ? (
          <FormSelect
            form={form}
            name={field.id}
            label="" // Label handled above
            options={field.options || []}
            placeholder={field.placeholder}
            disabled={field.disabled || disabled}
            className={`${inputClass} ${error ? "border-red-500" : ""}`}
            style={{ display: "block" }} // Override label display
          />
        ) : field.type === "checkbox" ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...form.register(field.id)}
              type="checkbox"
              disabled={field.disabled || disabled}
              className="w-4 h-4 accent-[#39FF14]"
            />
            <span className="text-white text-sm">{field.placeholder}</span>
          </label>
        ) : (
          <FormInput
            form={form}
            name={field.id}
            label="" // Label handled above
            type={field.type === "currency" ? "number" : field.type}
            placeholder={field.placeholder}
            disabled={field.disabled || disabled}
            className={`${inputClass} ${error ? "border-red-500" : ""}`}
            step={field.type === "currency" ? "0.01" : undefined}
            style={{ display: "block" }} // Override label display
          />
        )}

        {field.helpText && (
          <p className="flex items-center gap-1 text-gray-500 text-xs">
            <Info className="w-3 h-3" />
            {field.helpText}
          </p>
        )}
        {error && (
          <p className="flex items-center gap-1 text-red-500 text-xs">
            <AlertCircle className="w-3 h-3" />
            {error.message}
          </p>
        )}
      </div>
    );
  };

  const renderSection = (section: FormSection) => {
    const isCollapsed = collapsedSections.has(section.id);
    return (
      <div
        key={section.id}
        className="border border-[#444444] rounded-lg overflow-hidden"
      >
        <div
          className={`flex items-center justify-between p-3 bg-[#1A1A1A] ${section.collapsible ? "cursor-pointer hover:bg-[#252525]" : ""}`}
          onClick={() =>
            section.collapsible &&
            setCollapsedSections((prev) => {
              const next = new Set(prev);
              next.has(section.id)
                ? next.delete(section.id)
                : next.add(section.id);
              return next;
            })
          }
        >
          <div>
            <h3 className="text-white text-sm font-semibold">
              {section.title}
            </h3>
            {section.description && (
              <p className="text-gray-500 text-xs mt-1">
                {section.description}
              </p>
            )}
          </div>
          {section.collapsible &&
            (isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ))}
        </div>
        {!isCollapsed && (
          <div className="p-4 flex flex-col gap-4">
            {section.fields.map(renderField)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Form
      form={form}
      onSubmit={onSubmit}
      className={`bg-[#333333] border border-[#444444] rounded-lg p-6 ${className}`}
      loading={loading}
      disabled={disabled}
      submitLabel={submitLabel}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
    >
      {(title || agentName) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 className="text-white text-lg font-semibold">{title}</h2>
          )}
          {agentName && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#39FF14]/10 rounded-full text-[#39FF14] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Generated by {agentName}
            </span>
          )}
        </div>
      )}
      {description && (
        <p className="text-gray-400 text-sm mb-4">{description}</p>
      )}
      <div className="flex flex-col gap-4">
        {sections ? sections.map(renderSection) : allFields.map(renderField)}
      </div>
    </Form>
  );
};

export default SDUIForm;
