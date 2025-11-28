/**
 * SDUIForm Component
 * 
 * Dynamic form generation from JSON schema.
 * Supports full validation, conditional fields, and AI suggestions.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Check, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  X,
  RefreshCw
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type FieldType = 
  | 'text' 
  | 'number' 
  | 'email' 
  | 'password'
  | 'textarea' 
  | 'select' 
  | 'multiselect'
  | 'radio' 
  | 'checkbox' 
  | 'toggle'
  | 'date' 
  | 'datetime'
  | 'currency'
  | 'percentage'
  | 'slider'
  | 'range'
  | 'file'
  | 'hidden';

export interface FormFieldOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
}

export interface FormFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  email?: boolean;
  url?: boolean;
  custom?: (value: any, formValues: Record<string, any>) => string | null;
}

export interface ConditionalRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty' | 'in';
  value?: any;
}

export interface AISuggestion {
  value: any;
  confidence: number;
  reasoning?: string;
  source?: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  defaultValue?: any;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  helpText?: string;
  showIf?: ConditionalRule | ConditionalRule[];
  enableIf?: ConditionalRule | ConditionalRule[];
  aiSuggestion?: AISuggestion;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
  colSpan?: 1 | 2 | 3 | 4;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  columns?: 1 | 2 | 3 | 4;
  showIf?: ConditionalRule | ConditionalRule[];
}

export interface SDUIFormProps {
  id: string;
  title?: string;
  description?: string;
  sections?: FormSection[];
  fields?: FormField[];
  submitLabel?: string;
  cancelLabel?: string;
  resetLabel?: string;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  onCancel?: () => void;
  onReset?: () => void;
  onChange?: (values: Record<string, any>, fieldId: string) => void;
  onValidate?: (errors: Record<string, string>) => void;
  loading?: boolean;
  disabled?: boolean;
  showValidationOnBlur?: boolean;
  showValidationOnChange?: boolean;
  showReset?: boolean;
  agentName?: string;
  className?: string;
  layout?: 'vertical' | 'horizontal' | 'inline';
}

// ============================================================================
// Utilities
// ============================================================================

const evaluateCondition = (
  rule: ConditionalRule,
  values: Record<string, any>
): boolean => {
  const fieldValue = values[rule.field];
  
  switch (rule.operator) {
    case 'equals':
      return fieldValue === rule.value;
    case 'notEquals':
      return fieldValue !== rule.value;
    case 'contains':
      return String(fieldValue).includes(String(rule.value));
    case 'greaterThan':
      return Number(fieldValue) > Number(rule.value);
    case 'lessThan':
      return Number(fieldValue) < Number(rule.value);
    case 'isEmpty':
      return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'isNotEmpty':
      return !!fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(fieldValue);
    default:
      return true;
  }
};

const evaluateConditions = (
  rules: ConditionalRule | ConditionalRule[] | undefined,
  values: Record<string, any>
): boolean => {
  if (!rules) return true;
  const ruleArray = Array.isArray(rules) ? rules : [rules];
  return ruleArray.every(rule => evaluateCondition(rule, values));
};

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  field: FormField;
  value: any;
  error?: string;
  touched: boolean;
  onChange: (value: any) => void;
  onBlur: () => void;
  disabled?: boolean;
}

const inputBaseClass = `
  w-full px-3 py-2.5 
  bg-[#1A1A1A] border border-[#444444] rounded-md 
  text-white text-sm placeholder-gray-500
  focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/20 
  disabled:opacity-50 disabled:cursor-not-allowed 
  read-only:bg-[#252525] read-only:cursor-default
  transition-colors
`.replace(/\s+/g, ' ').trim();

const inputErrorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';

const TextField: React.FC<FieldProps> = ({ field, value, error, onChange, onBlur, disabled }) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = field.type === 'password' && showPassword ? 'text' : field.type;
  
  return (
    <div className="relative">
      {field.prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
          {field.prefix}
        </span>
      )}
      <input
        type={inputType === 'currency' ? 'number' : inputType}
        id={field.id}
        name={field.id}
        value={value ?? ''}
        onChange={(e) => onChange(field.type === 'number' || field.type === 'currency' ? Number(e.target.value) : e.target.value)}
        onBlur={onBlur}
        placeholder={field.placeholder}
        disabled={disabled || field.disabled}
        readOnly={field.readOnly}
        autoFocus={field.autoFocus}
        className={`${inputBaseClass} ${error ? inputErrorClass : ''} ${field.prefix ? 'pl-8' : ''} ${field.suffix || field.type === 'password' ? 'pr-10' : ''}`}
        step={field.type === 'currency' ? '0.01' : field.type === 'number' ? 'any' : undefined}
        min={field.validation?.min}
        max={field.validation?.max}
        minLength={field.validation?.minLength}
        maxLength={field.validation?.maxLength}
      />
      {field.type === 'password' && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
      {field.suffix && field.type !== 'password' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
          {field.suffix}
        </span>
      )}
    </div>
  );
};

const TextareaField: React.FC<FieldProps> = ({ field, value, error, onChange, onBlur, disabled }) => (
  <textarea
    id={field.id}
    name={field.id}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onBlur}
    placeholder={field.placeholder}
    disabled={disabled || field.disabled}
    readOnly={field.readOnly}
    autoFocus={field.autoFocus}
    rows={4}
    className={`${inputBaseClass} min-h-[100px] resize-y ${error ? inputErrorClass : ''}`}
    maxLength={field.validation?.maxLength}
  />
);

const SelectField: React.FC<FieldProps> = ({ field, value, error, onChange, onBlur, disabled }) => (
  <select
    id={field.id}
    name={field.id}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onBlur}
    disabled={disabled || field.disabled}
    className={`${inputBaseClass} ${error ? inputErrorClass : ''}`}
  >
    <option value="">{field.placeholder || 'Select an option...'}</option>
    {field.options?.map((opt) => (
      <option key={opt.value} value={opt.value} disabled={opt.disabled}>
        {opt.label}
      </option>
    ))}
  </select>
);

const RadioField: React.FC<FieldProps> = ({ field, value, onChange, disabled }) => (
  <div className="flex flex-col gap-2">
    {field.options?.map((opt) => (
      <label key={opt.value} className={`flex items-start gap-3 p-2 rounded-md cursor-pointer hover:bg-[#252525] transition-colors ${disabled || opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          type="radio"
          name={field.id}
          value={String(opt.value)}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
          disabled={disabled || field.disabled || opt.disabled}
          className="mt-0.5 w-4 h-4 accent-[#39FF14]"
        />
        <div>
          <span className="text-white text-sm font-medium">{opt.label}</span>
          {opt.description && <p className="text-gray-500 text-xs mt-0.5">{opt.description}</p>}
        </div>
      </label>
    ))}
  </div>
);

const CheckboxField: React.FC<FieldProps> = ({ field, value, onChange, disabled }) => (
  <label className={`flex items-center gap-3 cursor-pointer ${disabled || field.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <input
      type="checkbox"
      checked={value ?? false}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled || field.disabled}
      className="w-5 h-5 rounded accent-[#39FF14]"
    />
    <span className="text-white text-sm">{field.placeholder || field.label}</span>
  </label>
);

const ToggleField: React.FC<FieldProps> = ({ field, value, onChange, disabled }) => (
  <label className={`flex items-center gap-3 cursor-pointer ${disabled || field.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <div className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#39FF14]' : 'bg-[#444444]'}`}>
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : ''}`} />
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || field.disabled}
        className="sr-only"
      />
    </div>
    <span className="text-white text-sm">{field.placeholder || field.label}</span>
  </label>
);

const SliderField: React.FC<FieldProps> = ({ field, value, onChange, disabled }) => {
  const min = field.validation?.min ?? 0;
  const max = field.validation?.max ?? 100;
  const percentage = ((value ?? min) - min) / (max - min) * 100;
  
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 relative">
        <input
          type="range"
          id={field.id}
          value={value ?? min}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled || field.disabled}
          className="w-full h-2 bg-[#444444] rounded-lg appearance-none cursor-pointer accent-[#39FF14]"
          style={{
            background: `linear-gradient(to right, #39FF14 0%, #39FF14 ${percentage}%, #444444 ${percentage}%, #444444 100%)`
          }}
        />
      </div>
      <span className="text-[#39FF14] text-sm font-semibold min-w-[60px] text-right tabular-nums">
        {field.type === 'percentage' ? `${value ?? 0}%` : (value ?? 0).toLocaleString()}
        {field.suffix && ` ${field.suffix}`}
      </span>
    </div>
  );
};

const DateField: React.FC<FieldProps> = ({ field, value, error, onChange, onBlur, disabled }) => (
  <input
    type={field.type === 'datetime' ? 'datetime-local' : 'date'}
    id={field.id}
    name={field.id}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onBlur}
    disabled={disabled || field.disabled}
    className={`${inputBaseClass} ${error ? inputErrorClass : ''}`}
  />
);

const MultiSelectField: React.FC<FieldProps> = ({ field, value, onChange, disabled }) => {
  const selectedValues = Array.isArray(value) ? value : [];
  
  const toggleOption = (optValue: string | number) => {
    if (selectedValues.includes(optValue)) {
      onChange(selectedValues.filter(v => v !== optValue));
    } else {
      onChange([...selectedValues, optValue]);
    }
  };
  
  return (
    <div className="flex flex-wrap gap-2">
      {field.options?.map((opt) => {
        const isSelected = selectedValues.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleOption(opt.value)}
            disabled={disabled || field.disabled || opt.disabled}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${isSelected 
                ? 'bg-[#39FF14] text-[#121212]' 
                : 'bg-[#1A1A1A] border border-[#444444] text-gray-400 hover:border-[#39FF14] hover:text-white'
              }
              ${(disabled || opt.disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {opt.label}
            {isSelected && <X className="w-3 h-3" />}
          </button>
        );
      })}
    </div>
  );
};

// ============================================================================
// AI Suggestion Component
// ============================================================================

interface AISuggestionProps {
  suggestion: AISuggestion;
  currentValue: any;
  onAccept: () => void;
  onDismiss: () => void;
}

const AISuggestionBadge: React.FC<AISuggestionProps> = ({ suggestion, currentValue, onAccept, onDismiss }) => {
  const isApplied = currentValue === suggestion.value;
  
  if (isApplied) return null;
  
  return (
    <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="text-blue-400 font-medium">
              AI Suggestion ({Math.round(suggestion.confidence * 100)}% confident)
            </p>
            <p className="text-gray-400 mt-0.5">
              Suggested: <span className="text-white font-mono">{String(suggestion.value)}</span>
            </p>
            {suggestion.reasoning && (
              <p className="text-gray-500 mt-1">{suggestion.reasoning}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onAccept}
            className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30 transition-colors"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const SDUIForm: React.FC<SDUIFormProps> = ({
  id,
  title,
  description,
  sections,
  fields,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  resetLabel = 'Reset',
  onSubmit,
  onCancel,
  onReset,
  onChange,
  onValidate,
  loading = false,
  disabled = false,
  showValidationOnBlur = true,
  showValidationOnChange = false,
  showReset = false,
  agentName,
  className = '',
  layout = 'vertical',
}) => {
  // Flatten fields
  const allFields = useMemo(() => {
    if (fields) return fields;
    return sections?.flatMap(s => s.fields) || [];
  }, [fields, sections]);

  // Initialize values
  const initialValues = useMemo(() => {
    const values: Record<string, any> = {};
    allFields.forEach(field => {
      values[field.id] = field.defaultValue ?? (field.type === 'multiselect' ? [] : '');
    });
    return values;
  }, [allFields]);

  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(sections?.filter(s => s.defaultCollapsed).map(s => s.id) || [])
  );

  // Validate single field
  const validateField = useCallback((field: FormField, value: any): string | null => {
    const v = field.validation;
    if (!v) return null;

    // Required
    if (v.required) {
      if (value === '' || value === null || value === undefined) {
        return `${field.label} is required`;
      }
      if (Array.isArray(value) && value.length === 0) {
        return `Please select at least one ${field.label.toLowerCase()}`;
      }
    }

    // Skip other validations if empty and not required
    if (!value && value !== 0) return null;

    // String validations
    if (typeof value === 'string') {
      if (v.minLength && value.length < v.minLength) {
        return `${field.label} must be at least ${v.minLength} characters`;
      }
      if (v.maxLength && value.length > v.maxLength) {
        return `${field.label} must be at most ${v.maxLength} characters`;
      }
      if (v.pattern && !new RegExp(v.pattern).test(value)) {
        return v.patternMessage || `${field.label} format is invalid`;
      }
      if (v.email && !validateEmail(value)) {
        return 'Please enter a valid email address';
      }
      if (v.url && !validateUrl(value)) {
        return 'Please enter a valid URL';
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (v.min !== undefined && value < v.min) {
        return `${field.label} must be at least ${v.min}`;
      }
      if (v.max !== undefined && value > v.max) {
        return `${field.label} must be at most ${v.max}`;
      }
    }

    // Custom validation
    if (v.custom) {
      return v.custom(value, values);
    }

    return null;
  }, [values]);

  // Check visibility
  const isFieldVisible = useCallback((field: FormField): boolean => {
    return evaluateConditions(field.showIf, values);
  }, [values]);

  // Check enabled
  const isFieldEnabled = useCallback((field: FormField): boolean => {
    if (!field.enableIf) return true;
    return evaluateConditions(field.enableIf, values);
  }, [values]);

  // Check section visibility
  const isSectionVisible = useCallback((section: FormSection): boolean => {
    return evaluateConditions(section.showIf, values);
  }, [values]);

  // Handle change
  const handleChange = useCallback((fieldId: string, value: any) => {
    const newValues = { ...values, [fieldId]: value };
    setValues(newValues);

    // Validate on change if enabled
    if (showValidationOnChange && touched.has(fieldId)) {
      const field = allFields.find(f => f.id === fieldId);
      if (field) {
        const error = validateField(field, value);
        const newErrors = { ...errors, [fieldId]: error || '' };
        setErrors(newErrors);
        onValidate?.(newErrors);
      }
    }

    onChange?.(newValues, fieldId);
  }, [values, allFields, touched, errors, showValidationOnChange, validateField, onChange, onValidate]);

  // Handle blur
  const handleBlur = useCallback((fieldId: string) => {
    setTouched(prev => new Set(prev).add(fieldId));

    if (showValidationOnBlur) {
      const field = allFields.find(f => f.id === fieldId);
      if (field) {
        const error = validateField(field, values[fieldId]);
        const newErrors = { ...errors, [fieldId]: error || '' };
        setErrors(newErrors);
        onValidate?.(newErrors);
      }
    }
  }, [allFields, values, errors, showValidationOnBlur, validateField, onValidate]);

  // Handle AI suggestion accept
  const handleAcceptSuggestion = useCallback((fieldId: string, value: any) => {
    handleChange(fieldId, value);
  }, [handleChange]);

  // Handle AI suggestion dismiss
  const handleDismissSuggestion = useCallback((fieldId: string) => {
    setDismissedSuggestions(prev => new Set(prev).add(fieldId));
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched(new Set());
    setDismissedSuggestions(new Set());
    onReset?.();
  }, [initialValues, onReset]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all visible fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    allFields.forEach(field => {
      if (!isFieldVisible(field)) return;

      const error = validateField(field, values[field.id]);
      if (error) {
        newErrors[field.id] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setTouched(new Set(allFields.map(f => f.id)));
    onValidate?.(newErrors);

    if (!hasErrors) {
      await onSubmit(values);
    }
  }, [allFields, values, isFieldVisible, validateField, onSubmit, onValidate]);

  // Get field component
  const getFieldComponent = (type: FieldType) => {
    switch (type) {
      case 'textarea': return TextareaField;
      case 'select': return SelectField;
      case 'multiselect': return MultiSelectField;
      case 'radio': return RadioField;
      case 'checkbox': return CheckboxField;
      case 'toggle': return ToggleField;
      case 'slider':
      case 'range':
      case 'percentage': return SliderField;
      case 'date':
      case 'datetime': return DateField;
      default: return TextField;
    }
  };

  // Render field
  const renderField = (field: FormField) => {
    if (!isFieldVisible(field)) return null;
    if (field.type === 'hidden') {
      return <input key={field.id} type="hidden" name={field.id} value={values[field.id] ?? ''} />;
    }

    const error = errors[field.id];
    const isTouched = touched.has(field.id);
    const isEnabled = isFieldEnabled(field);
    const FieldComponent = getFieldComponent(field.type);
    const showSuggestion = field.aiSuggestion && !dismissedSuggestions.has(field.id);

    const colSpanClass = field.colSpan ? `col-span-${field.colSpan}` : '';

    return (
      <div key={field.id} className={`flex flex-col gap-1.5 ${colSpanClass}`}>
        {/* Label row */}
        {field.type !== 'checkbox' && field.type !== 'toggle' && (
          <div className="flex items-center justify-between">
            <label htmlFor={field.id} className="text-white text-sm font-medium">
              {field.label}
              {field.validation?.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.aiSuggestion && !dismissedSuggestions.has(field.id) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded text-blue-400 text-[10px] font-medium">
                <Sparkles className="w-3 h-3" />
                AI Suggested
              </span>
            )}
          </div>
        )}

        {/* Field */}
        <FieldComponent
          field={field}
          value={values[field.id]}
          error={isTouched ? error : undefined}
          touched={isTouched}
          onChange={(v) => handleChange(field.id, v)}
          onBlur={() => handleBlur(field.id)}
          disabled={disabled || !isEnabled}
        />

        {/* AI Suggestion */}
        {showSuggestion && field.aiSuggestion && (
          <AISuggestionBadge
            suggestion={field.aiSuggestion}
            currentValue={values[field.id]}
            onAccept={() => handleAcceptSuggestion(field.id, field.aiSuggestion!.value)}
            onDismiss={() => handleDismissSuggestion(field.id)}
          />
        )}

        {/* Help text */}
        {field.helpText && (
          <p className="flex items-center gap-1.5 text-gray-500 text-xs">
            <Info className="w-3 h-3 flex-shrink-0" />
            {field.helpText}
          </p>
        )}

        {/* Error */}
        {isTouched && error && (
          <p className="flex items-center gap-1.5 text-red-500 text-xs">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  };

  // Render section
  const renderSection = (section: FormSection) => {
    if (!isSectionVisible(section)) return null;

    const isCollapsed = collapsedSections.has(section.id);
    const gridCols = section.columns ? `grid-cols-${section.columns}` : 'grid-cols-1';

    return (
      <div key={section.id} className="border border-[#444444] rounded-lg overflow-hidden">
        <div
          className={`flex items-center justify-between p-4 bg-[#1A1A1A] ${section.collapsible ? 'cursor-pointer hover:bg-[#252525]' : ''} transition-colors`}
          onClick={() => {
            if (section.collapsible) {
              setCollapsedSections(prev => {
                const next = new Set(prev);
                next.has(section.id) ? next.delete(section.id) : next.add(section.id);
                return next;
              });
            }
          }}
        >
          <div>
            <h3 className="text-white text-sm font-semibold">{section.title}</h3>
            {section.description && (
              <p className="text-gray-500 text-xs mt-1">{section.description}</p>
            )}
          </div>
          {section.collapsible && (
            isCollapsed 
              ? <ChevronDown className="w-5 h-5 text-gray-400" /> 
              : <ChevronUp className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {!isCollapsed && (
          <div className={`p-4 grid gap-4 ${gridCols}`}>
            {section.fields.map(renderField)}
          </div>
        )}
      </div>
    );
  };

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className={`bg-[#333333] border border-[#444444] rounded-lg p-6 ${className}`}
    >
      {/* Header */}
      {(title || agentName) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-white text-lg font-semibold">{title}</h2>}
          {agentName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#39FF14]/10 rounded-full text-[#39FF14] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Generated by {agentName}
            </span>
          )}
        </div>
      )}

      {description && (
        <p className="text-gray-400 text-sm mb-6">{description}</p>
      )}

      {/* Fields */}
      <div className="flex flex-col gap-5">
        {sections ? sections.map(renderSection) : (
          <div className={`grid gap-4 ${layout === 'horizontal' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {allFields.map(renderField)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#444444]">
        <div>
          {showReset && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading || disabled}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-500 text-sm font-medium hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {resetLabel}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading || disabled}
              className="px-5 py-2.5 bg-transparent border border-[#444444] rounded-md text-gray-400 text-sm font-semibold hover:border-[#39FF14] hover:text-[#39FF14] disabled:opacity-50 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="submit"
            disabled={loading || disabled}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#39FF14] to-[#0A3A0A] rounded-md text-[#121212] text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SDUIForm;
