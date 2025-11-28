import React, { useState, useMemo, useCallback } from 'react';
import { Check, AlertCircle, Info, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';

// Types
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
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'currency' | 'slider' | 'hidden';
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

const inputClass = "w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#444444] rounded-md text-white text-sm focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/20 disabled:opacity-50 transition-colors";

export const SDUIForm: React.FC<SDUIFormProps> = ({
  id,
  title,
  description,
  sections,
  fields,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  onSubmit,
  onCancel,
  onChange,
  loading = false,
  disabled = false,
  agentName,
  className = '',
}) => {
  const allFields = useMemo(() => fields || sections?.flatMap(s => s.fields) || [], [fields, sections]);

  const initialValues = useMemo(() => {
    const v: Record<string, any> = {};
    allFields.forEach(f => { v[f.id] = f.defaultValue ?? ''; });
    return v;
  }, [allFields]);

  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(sections?.filter(s => s.defaultCollapsed).map(s => s.id) || []));

  const validate = useCallback((field: FormField, value: any): string | null => {
    const v = field.validation;
    if (!v) return null;
    if (v.required && !value) return `${field.label} is required`;
    if (typeof value === 'string' && v.minLength && value.length < v.minLength) return `Min ${v.minLength} chars`;
    if (typeof value === 'string' && v.maxLength && value.length > v.maxLength) return `Max ${v.maxLength} chars`;
    return null;
  }, []);

  const handleChange = useCallback((fieldId: string, value: any) => {
    const newValues = { ...values, [fieldId]: value };
    setValues(newValues);
    onChange?.(newValues);
  }, [values, onChange]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    allFields.forEach(f => {
      const err = validate(f, values[f.id]);
      if (err) newErrors[f.id] = err;
    });
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) await onSubmit(values);
  }, [allFields, values, validate, onSubmit]);

  const renderField = (field: FormField) => {
    if (field.type === 'hidden') return null;
    const error = errors[field.id];

    return (
      <div key={field.id} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={field.id} className="text-white text-sm font-medium">
            {field.label}
            {field.validation?.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {field.aiSuggested && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded text-blue-400 text-[11px]">
              <Sparkles className="w-3 h-3" />AI
            </span>
          )}
        </div>
        
        {field.type === 'textarea' ? (
          <textarea
            id={field.id}
            value={values[field.id] ?? ''}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={field.disabled}
            rows={4}
            className={`${inputClass} min-h-[100px] resize-y ${error ? 'border-red-500' : ''}`}
          />
        ) : field.type === 'select' ? (
          <select
            id={field.id}
            value={values[field.id] ?? ''}
            onChange={(e) => handleChange(field.id, e.target.value)}
            disabled={field.disabled}
            className={`${inputClass} ${error ? 'border-red-500' : ''}`}
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : field.type === 'checkbox' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values[field.id] ?? false}
              onChange={(e) => handleChange(field.id, e.target.checked)}
              disabled={field.disabled}
              className="w-4 h-4 accent-[#39FF14]"
            />
            <span className="text-white text-sm">{field.placeholder}</span>
          </label>
        ) : (
          <input
            type={field.type === 'currency' ? 'number' : field.type}
            id={field.id}
            value={values[field.id] ?? ''}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={field.disabled}
            className={`${inputClass} ${error ? 'border-red-500' : ''}`}
            step={field.type === 'currency' ? '0.01' : undefined}
          />
        )}
        
        {field.helpText && (
          <p className="flex items-center gap-1 text-gray-500 text-xs">
            <Info className="w-3 h-3" />{field.helpText}
          </p>
        )}
        {error && (
          <p className="flex items-center gap-1 text-red-500 text-xs">
            <AlertCircle className="w-3 h-3" />{error}
          </p>
        )}
      </div>
    );
  };

  const renderSection = (section: FormSection) => {
    const isCollapsed = collapsed.has(section.id);
    return (
      <div key={section.id} className="border border-[#444444] rounded-lg overflow-hidden">
        <div
          className={`flex items-center justify-between p-3 bg-[#1A1A1A] ${section.collapsible ? 'cursor-pointer hover:bg-[#252525]' : ''}`}
          onClick={() => section.collapsible && setCollapsed(prev => {
            const next = new Set(prev);
            next.has(section.id) ? next.delete(section.id) : next.add(section.id);
            return next;
          })}
        >
          <div>
            <h3 className="text-white text-sm font-semibold">{section.title}</h3>
            {section.description && <p className="text-gray-500 text-xs mt-1">{section.description}</p>}
          </div>
          {section.collapsible && (isCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />)}
        </div>
        {!isCollapsed && <div className="p-4 flex flex-col gap-4">{section.fields.map(renderField)}</div>}
      </div>
    );
  };

  return (
    <form id={id} onSubmit={handleSubmit} className={`bg-[#333333] border border-[#444444] rounded-lg p-6 ${className}`}>
      {(title || agentName) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-white text-lg font-semibold">{title}</h2>}
          {agentName && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#39FF14]/10 rounded-full text-[#39FF14] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />Generated by {agentName}
            </span>
          )}
        </div>
      )}
      {description && <p className="text-gray-400 text-sm mb-4">{description}</p>}
      <div className="flex flex-col gap-4">
        {sections ? sections.map(renderSection) : allFields.map(renderField)}
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#444444]">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={loading || disabled}
            className="px-5 py-2.5 bg-transparent border border-[#444444] rounded-md text-gray-400 text-sm font-semibold hover:border-[#39FF14] hover:text-[#39FF14] disabled:opacity-50 transition-colors">
            {cancelLabel}
          </button>
        )}
        <button type="submit" disabled={loading || disabled}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#39FF14] to-[#0A3A0A] rounded-md text-[#121212] text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><Check className="w-4 h-4" />{submitLabel}</>}
        </button>
      </div>
    </form>
  );
};

export default SDUIForm;
